import sql from "@/app/api/utils/sql";
import { enforceLeaseAndLandlordEndings } from "./leaseEnforcement";
import { normalizeFixedFeeInvoices } from "./fixedFeeNormalization";
import { ensureInvoiceAccrualLedgerEntries } from "./invoiceAccrualLedger";
import { autoApplyAdvancePaymentsToOpenInvoices } from "../payments/autoApply";
import {
  isMonthlyInvoiceGenerationDue,
  recordMonthlyRunStart,
  recordMonthlyRunSuccess,
  recordMonthlyRunFailure,
} from "./monthlyRunTracking";
import {
  getLastEnsureInvoicesAtMs,
  setLastEnsureInvoicesAtMs,
  getEnsureInvoicesPromise,
  setEnsureInvoicesPromise,
  getEnsureInvoicesIntervalMs,
} from "./throttling";

/**
 * Ensures invoices exist for ALL ACTIVE leases from their start month
 * up to the current month.
 *
 * Management fees are NO LONGER stored per invoice line.
 * We always store commission_rate/commission_amount as 0 on invoices,
 * and compute/post management fees as ONE entry per property-month in the ledger.
 */
export async function ensureInvoicesForAllActiveLeasesUpToCurrentMonth(
  options = {},
) {
  const force = options?.force === true;
  const runDate =
    options?.runDate instanceof Date ? options.runDate : new Date();
  const recordMonthlyRun = options?.recordMonthlyRun === true;
  const now = Date.now();

  // If a run is already in progress, wait for it.
  // IMPORTANT: do NOT early-return for forced/monthly runs, because the in-flight run
  // may have started before the caller's lease changes were committed.
  if (getEnsureInvoicesPromise()) {
    try {
      await getEnsureInvoicesPromise();
    } catch (e) {
      // Best effort: if the in-flight run failed, we still want to attempt a new run below.
      console.error(
        "ensureInvoicesForAllActiveLeasesUpToCurrentMonth: previous run failed",
        e,
      );
    }
  }

  // If it's the 1st and we haven't recorded a successful run for this month yet,
  // override throttling so invoices get generated ASAP.
  // Also allow callers to force a recorded monthly run for a specific month/year.
  const monthlyDue = recordMonthlyRun
    ? true
    : force
      ? false
      : await isMonthlyInvoiceGenerationDue(runDate);

  // Skip frequent backfills for read-heavy endpoints.
  if (
    !force &&
    !monthlyDue &&
    now - getLastEnsureInvoicesAtMs() < getEnsureInvoicesIntervalMs()
  ) {
    // Even if we skip invoice generation, keep the ledger synced (best effort).
    try {
      await normalizeFixedFeeInvoices();
    } catch (e) {
      console.error("normalizeFixedFeeInvoices (throttled) failed", e);
    }

    try {
      await ensureInvoiceAccrualLedgerEntries();
    } catch (e) {
      console.error("ensureInvoiceAccrualLedgerEntries (throttled) failed", e);
    }

    return 0;
  }

  setLastEnsureInvoicesAtMs(now);

  const runMonth = runDate.getMonth() + 1;
  const runYear = runDate.getFullYear();

  const promise = (async () => {
    // Record the start of a "monthly" run (best-effort).
    if (monthlyDue) {
      await recordMonthlyRunStart(runMonth, runYear);
    }

    await enforceLeaseAndLandlordEndings();

    const query = `
      WITH lease_months AS (
        SELECT
          l.id AS lease_id,
          l.tenant_id,
          l.unit_id,
          u.property_id,
          l.monthly_rent AS amount,
          l.currency,
          COALESCE(p.management_fee_type, 'percent')::text AS management_fee_type,
          COALESCE(p.management_fee_percent, 0)::numeric(5,2) AS management_fee_percent,
          COALESCE(p.management_fee_fixed_amount, 0)::numeric(15,2) AS management_fee_fixed_amount,
          gs.month_start::date AS invoice_date,
          gs.month_start::date AS due_date,
          EXTRACT(MONTH FROM gs.month_start)::int AS invoice_month,
          EXTRACT(YEAR FROM gs.month_start)::int AS invoice_year
        FROM leases l
        JOIN tenants t ON t.id = l.tenant_id
        JOIN units u ON u.id = l.unit_id
        JOIN properties p ON p.id = u.property_id
        JOIN landlords ld ON ld.id = p.landlord_id
        JOIN LATERAL generate_series(
          GREATEST(
            date_trunc('month', l.start_date)::date,
            date_trunc('month', COALESCE(ld.start_date, l.start_date))::date
          ),
          date_trunc('month', LEAST(l.end_date, COALESCE(ld.end_date, l.end_date), CURRENT_DATE))::date,
          interval '1 month'
        ) AS gs(month_start) ON true
        WHERE l.status = 'active'
          AND COALESCE(t.status, 'active') = 'active'
          AND COALESCE(ld.status, 'active') = 'active'
          AND (ld.start_date IS NULL OR gs.month_start::date >= date_trunc('month', ld.start_date)::date)
          AND (ld.end_date IS NULL OR gs.month_start::date <= ld.end_date)
      ),
      to_insert AS (
        SELECT
          lm.lease_id,
          lm.tenant_id,
          lm.property_id,
          lm.unit_id,
          lm.invoice_date,
          lm.due_date,
          lm.invoice_month,
          lm.invoice_year,
          ('Rent for: ' || to_char(lm.invoice_date, 'FMMonth') || ' ' || lm.invoice_year)::text AS description,
          lm.amount,
          lm.currency,
          0 AS commission_rate,
          0 AS commission_amount
        FROM lease_months lm
        WHERE NOT EXISTS (
          SELECT 1
          FROM invoices i
          WHERE i.lease_id = lm.lease_id
            AND i.invoice_month = lm.invoice_month
            AND i.invoice_year = lm.invoice_year
            AND i.description LIKE 'Rent for:%'
            AND i.is_deleted = true
        )
      ),
      inserted AS (
        INSERT INTO invoices (
          lease_id, tenant_id, property_id, unit_id,
          invoice_date, due_date,
          invoice_month, invoice_year,
          description,
          amount, currency,
          commission_rate, commission_amount,
          paid_amount, status
        )
        SELECT
          ti.lease_id,
          ti.tenant_id,
          ti.property_id,
          ti.unit_id,
          ti.invoice_date,
          ti.due_date,
          ti.invoice_month,
          ti.invoice_year,
          ti.description,
          ti.amount,
          ti.currency,
          ti.commission_rate,
          ti.commission_amount,
          0,
          'open'
        FROM to_insert ti
        ON CONFLICT (lease_id, invoice_month, invoice_year)
          WHERE COALESCE(is_deleted, false) = false
            AND description LIKE 'Rent for:%'
        DO NOTHING
        RETURNING 1
      )
      SELECT (SELECT COUNT(*)::int FROM inserted) AS inserted_count
    `;

    const rows = await sql(query, []);
    const insertedCount = Number(rows?.[0]?.inserted_count || 0);

    // NEW: wipe legacy fixed-fee allocations (best effort)
    try {
      await normalizeFixedFeeInvoices({ force: true });
    } catch (e) {
      console.error("normalizeFixedFeeInvoices failed", e);
    }

    // NEW: ensure the ledger reflects invoice accruals (and fixed fees).
    try {
      await ensureInvoiceAccrualLedgerEntries({ force: true });
    } catch (e) {
      console.error("ensureInvoiceAccrualLedgerEntries failed", e);
    }

    // NEW: auto-apply any advance (unallocated) payments to newly-open invoices (best effort)
    try {
      await autoApplyAdvancePaymentsToOpenInvoices({ limit: 500 });
    } catch (e) {
      console.error("autoApplyAdvancePaymentsToOpenInvoices failed", e);
    }

    if (monthlyDue) {
      await recordMonthlyRunSuccess(runMonth, runYear, insertedCount);
    }

    return insertedCount;
  })();

  setEnsureInvoicesPromise(promise);

  try {
    const insertedCount = await promise;
    return insertedCount;
  } catch (error) {
    if (monthlyDue) {
      await recordMonthlyRunFailure(runMonth, runYear, error);
    }
    throw error;
  } finally {
    setEnsureInvoicesPromise(null);
    setLastEnsureInvoicesAtMs(Date.now());
  }
}

/**
 * Ensures invoices exist for a single lease.
 *
 * IMPORTANT: This is used during create/update flows and should be fast.
 * We generate only this lease's missing invoices, but still recompute fixed-fee
 * allocations for the affected property-months so accounting stays consistent.
 */
export async function ensureInvoicesForLease(leaseId, options = {}) {
  const idNum = Number(leaseId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    throw new Error("ensureInvoicesForLease: invalid leaseId");
  }

  await enforceLeaseAndLandlordEndings();

  const query = `
    WITH lease_months AS (
      SELECT
        l.id AS lease_id,
        l.tenant_id,
        l.unit_id,
        u.property_id,
        l.monthly_rent AS amount,
        l.currency,
        COALESCE(p.management_fee_type, 'percent')::text AS management_fee_type,
        COALESCE(p.management_fee_percent, 0)::numeric(5,2) AS management_fee_percent,
        gs.month_start::date AS invoice_date,
        gs.month_start::date AS due_date,
        EXTRACT(MONTH FROM gs.month_start)::int AS invoice_month,
        EXTRACT(YEAR FROM gs.month_start)::int AS invoice_year
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      JOIN landlords ld ON ld.id = p.landlord_id
      JOIN LATERAL generate_series(
        GREATEST(
          date_trunc('month', l.start_date)::date,
          date_trunc('month', COALESCE(ld.start_date, l.start_date))::date
        ),
        date_trunc('month', LEAST(l.end_date, COALESCE(ld.end_date, l.end_date), CURRENT_DATE))::date,
        interval '1 month'
      ) AS gs(month_start) ON true
      WHERE l.id = $1
        AND l.status = 'active'
        AND COALESCE(t.status, 'active') = 'active'
        AND COALESCE(ld.status, 'active') = 'active'
        AND (ld.start_date IS NULL OR gs.month_start::date >= date_trunc('month', ld.start_date)::date)
        AND (ld.end_date IS NULL OR gs.month_start::date <= ld.end_date)
    ),
    to_insert AS (
      SELECT
        lm.lease_id,
        lm.tenant_id,
        lm.property_id,
        lm.unit_id,
        lm.invoice_date,
        lm.due_date,
        lm.invoice_month,
        lm.invoice_year,
        ('Rent for: ' || to_char(lm.invoice_date, 'FMMonth') || ' ' || lm.invoice_year)::text AS description,
        lm.amount,
        lm.currency,
        0 AS commission_rate,
        0 AS commission_amount
      FROM lease_months lm
      WHERE NOT EXISTS (
        SELECT 1
        FROM invoices i
        WHERE i.lease_id = lm.lease_id
          AND i.invoice_month = lm.invoice_month
          AND i.invoice_year = lm.invoice_year
          AND i.description LIKE 'Rent for:%'
          AND i.is_deleted = true
      )
    ),
    inserted AS (
      INSERT INTO invoices (
        lease_id, tenant_id, property_id, unit_id,
        invoice_date, due_date,
        invoice_month, invoice_year,
        description,
        amount, currency,
        commission_rate, commission_amount,
        paid_amount, status
      )
      SELECT
        ti.lease_id,
        ti.tenant_id,
        ti.property_id,
        ti.unit_id,
        ti.invoice_date,
        ti.due_date,
        ti.invoice_month,
        ti.invoice_year,
        ti.description,
        ti.amount,
        ti.currency,
        ti.commission_rate,
        ti.commission_amount,
        0,
        'open'
      FROM to_insert ti
      ON CONFLICT (lease_id, invoice_month, invoice_year)
        WHERE COALESCE(is_deleted, false) = false
          AND description LIKE 'Rent for:%'
      DO NOTHING
      RETURNING 1
    )
    SELECT (SELECT COUNT(*)::int FROM inserted) AS inserted_count
  `;

  const rows = await sql(query, [idNum]);
  const insertedCount = Number(rows?.[0]?.inserted_count || 0);

  // NEW: wipe legacy fixed-fee allocations (best effort)
  try {
    await normalizeFixedFeeInvoices();
  } catch (e) {
    console.error("normalizeFixedFeeInvoices (lease) failed", e);
  }

  // NEW: sync ledger accrual entries for this lease only.
  try {
    await ensureInvoiceAccrualLedgerEntries({ force: true, leaseId: idNum });
  } catch (e) {
    console.error("ensureInvoiceAccrualLedgerEntries (lease) failed", e);
  }

  return insertedCount;
}

/**
 * Ensures invoices exist for all active leases of a tenant.
 * Delegates to the bulk generator to keep fixed-fee allocations consistent.
 */
export async function ensureInvoicesForTenant(_tenantId, options = {}) {
  await ensureInvoicesForAllActiveLeasesUpToCurrentMonth(options);
}
