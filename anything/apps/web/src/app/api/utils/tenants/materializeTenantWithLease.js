import sql from "@/app/api/utils/sql";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

// Namespace for pg_advisory_xact_lock(ns, unit_id) so approvals of the same
// unit serialise instead of racing past each other's overlap check.
const UNIT_LOCK_NAMESPACE = 41130;

const TENANT_COLUMNS = [
  "id",
  "title",
  "full_name",
  "phone",
  "email",
  "national_id",
  "emergency_contact",
  "emergency_phone",
  "status",
  "created_at",
];

/**
 * Creates tenant -> lease -> unit occupied -> security deposit (Dr 1130 /
 * Cr 2200) in ONE statement of chained CTEs, so it all commits or none of it
 * does. Invoices are NOT created here; callers run ensureInvoicesForLease
 * after this returns.
 *
 * The source row comes from either:
 *   - `values` (admin create): the tenant + lease fields as parameters, or
 *   - `submissionId` (approval): DELETE FROM tenant_submissions ... RETURNING,
 *     which doubles as the claim — a second approval finds no row.
 * Either way the source is only produced if the unit has no overlapping
 * active lease and its property isn't archived; otherwise nothing is written
 * and this returns null.
 *
 * Runs under a per-unit advisory lock (unitId), held for the transaction, so
 * two creates/approvals for the same unit can't both pass the overlap check.
 *
 * Returns { tenant, lease, depositPosted } or null.
 */
export async function materializeTenantWithLease({
  values = null,
  submissionId = null,
  tenantStatus = "active",
  approval,
  unitId,
}) {
  if (!values === !submissionId) {
    throw new Error("Pass exactly one of values or submissionId");
  }
  if (!unitId) throw new Error("unitId is required for the unit lock");

  // Resolved up front: the deposit is skipped (as before) if either is missing.
  const [undepositedFundsId, tenantDepositsPayableId] = await Promise.all([
    getAccountIdByCode("1130"),
    getAccountIdByCode("2200"),
  ]);
  const postDeposit = Boolean(undepositedFundsId && tenantDepositsPayableId);
  const depositDate = new Date().toISOString().slice(0, 10);

  const params = [];
  const p = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const overlapGuard = (unit, start, end) => `
    NOT EXISTS (
      SELECT 1 FROM leases ol
      WHERE ol.unit_id = ${unit}
        AND ol.status = 'active'
        AND ol.start_date <= ${end}
        AND ol.end_date >= ${start}
    )
    AND NOT EXISTS (
      SELECT 1 FROM units au
      JOIN properties ap ON ap.id = au.property_id
      WHERE au.id = ${unit} AND COALESCE(ap.is_deleted, false) = true
    )`;

  let srcCte;
  if (submissionId) {
    srcCte = `
      src AS (
        DELETE FROM tenant_submissions s
        WHERE s.id = ${p(submissionId)}::int
          AND ${overlapGuard("s.unit_id", "s.start_date", "s.end_date")}
        RETURNING
          s.title, s.full_name, s.phone, s.email, s.national_id,
          s.emergency_contact, s.emergency_phone,
          s.unit_id, s.start_date, s.end_date, s.monthly_rent, s.currency,
          s.deposit_amount, s.billing_day, s.auto_renew,
          s.requested_by AS created_by
      )`;
  } else {
    const unit = `${p(values.unit_id)}::int`;
    const start = `${p(values.start_date)}::date`;
    const end = `${p(values.end_date)}::date`;
    srcCte = `
      src AS (
        SELECT
          ${p(values.title)}::varchar AS title,
          ${p(values.full_name)}::varchar AS full_name,
          ${p(values.phone)}::varchar AS phone,
          ${p(values.email)}::varchar AS email,
          ${p(values.national_id)}::varchar AS national_id,
          ${p(values.emergency_contact)}::varchar AS emergency_contact,
          ${p(values.emergency_phone)}::varchar AS emergency_phone,
          ${unit} AS unit_id,
          ${start} AS start_date,
          ${end} AS end_date,
          ${p(values.monthly_rent)}::numeric AS monthly_rent,
          ${p(values.currency)}::varchar AS currency,
          ${p(values.deposit_amount)}::numeric AS deposit_amount,
          ${p(values.billing_day)}::int AS billing_day,
          ${p(values.auto_renew)}::boolean AS auto_renew,
          ${p(values.created_by)}::int AS created_by
        WHERE ${overlapGuard(unit, start, end)}
      )`;
  }

  const query = `
    WITH ${srcCte},
    new_tenant AS (
      INSERT INTO tenants (
        title, full_name, phone, email, national_id, emergency_contact, emergency_phone,
        status, approval_status, approved_by, approved_at, created_by
      )
      SELECT
        title, full_name, phone, email, national_id, emergency_contact, emergency_phone,
        ${p(tenantStatus)}::varchar,
        ${p(approval.approval_status)}::varchar,
        ${p(approval.approved_by)}::int,
        ${p(approval.approved_at)}::timestamp,
        created_by
      FROM src
      RETURNING ${TENANT_COLUMNS.join(", ")}
    ),
    new_lease AS (
      INSERT INTO leases (
        unit_id, tenant_id, start_date, end_date, monthly_rent, currency,
        deposit_amount, deposit_paid, billing_day, auto_renew, status, created_by
      )
      SELECT
        s.unit_id, t.id, s.start_date, s.end_date, s.monthly_rent, s.currency,
        s.deposit_amount, 0, s.billing_day, s.auto_renew, 'active', s.created_by
      FROM src s CROSS JOIN new_tenant t
      RETURNING *
    ),
    occupied AS (
      UPDATE units SET status = 'occupied'
      WHERE id IN (SELECT unit_id FROM new_lease)
      RETURNING id
    ),
    deposit AS (
      INSERT INTO transactions (
        transaction_date, description, reference_number,
        debit_account_id, credit_account_id,
        amount, currency,
        created_by,
        property_id,
        source_type, source_id
      )
      SELECT
        ${p(depositDate)}::date, 'Security deposit - ' || s.full_name, 'SD-' || l.id,
        ${p(undepositedFundsId)}::int, ${p(tenantDepositsPayableId)}::int,
        s.deposit_amount, s.currency,
        s.created_by,
        u.property_id,
        'security_deposit', l.id
      FROM src s
      CROSS JOIN new_lease l
      JOIN units u ON u.id = l.unit_id
      WHERE ${p(postDeposit)}::boolean AND COALESCE(s.deposit_amount, 0) > 0
      RETURNING id
    )
    SELECT
      ${TENANT_COLUMNS.map((c) => `t.${c} AS tenant__${c}`).join(", ")},
      l.*,
      (SELECT COUNT(*) FROM occupied)::int AS units_occupied,
      (SELECT COUNT(*) FROM deposit)::int AS deposits_posted
    FROM new_tenant t CROSS JOIN new_lease l
  `;

  // Statement 2 takes its snapshot after statement 1 acquires the lock, so its
  // overlap check sees any lease committed by a competing create/approval.
  const [, rows] = await sql.transaction([
    sql(`SELECT pg_advisory_xact_lock($1, $2)`, [
      UNIT_LOCK_NAMESPACE,
      Number(unitId),
    ]),
    sql(query, params),
  ]);

  const row = rows?.[0];
  if (!row) return null;

  const tenant = {};
  const lease = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("tenant__")) {
      tenant[key.slice(8)] = value;
    } else if (key !== "units_occupied" && key !== "deposits_posted") {
      lease[key] = value;
    }
  }

  return { tenant, lease, depositPosted: Number(row.deposits_posted) > 0 };
}
