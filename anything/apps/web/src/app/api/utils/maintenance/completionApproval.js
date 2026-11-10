import sql from "@/app/api/utils/sql";
import { writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getAccountIdByCode,
} from "@/app/api/utils/accounting";
import { createNotification } from "@/app/api/utils/notifications";

// A non-admin completion with a cost is saved on the request but posts no
// GL entry until an Admin approves it. No extra columns: a completion is
// "pending approval" while it carries a cost, account and charge type but
// has no transaction_id. Approval sets transaction_id; rejection clears the
// pending cost and returns the job to in_progress.
//
// (approval_required / approved_at belong to the separate pre-work estimate
// approval and are not used here.)

// SQL condition for "pending approval"; alias qualifies the columns.
export function pendingCompletionWhere(alias = "") {
  const c = alias ? `${alias}.` : "";
  return `
  ${c}status = 'completed'
  AND ${c}transaction_id IS NULL
  AND COALESCE(${c}completed_cost, 0) > 0
  AND ${c}payment_account_id IS NOT NULL
  AND ${c}charge_type IN ('landlord', 'company')
`;
}

export const PENDING_COMPLETION_SQL = pendingCompletionWhere();

export function isPendingCompletion(row) {
  return (
    !!row &&
    row.status === "completed" &&
    !row.transaction_id &&
    Number(row.completed_cost || 0) > 0 &&
    !!row.payment_account_id &&
    (row.charge_type === "landlord" || row.charge_type === "company")
  );
}

function ymd(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// Same description an Admin completion writes (maintenance/[id] PUT).
export async function maintenanceGlDescription(row) {
  const title = row.title || "";
  if (row.tenant_id) {
    const tenantRows =
      await sql`SELECT full_name FROM tenants WHERE id = ${row.tenant_id} LIMIT 1`;
    const tenantFullName = tenantRows?.[0]?.full_name || null;
    if (tenantFullName) {
      return `Maintenance: ${tenantFullName} - ${title.slice(0, 180)}`;
    }
  }
  return `Maintenance: ${title.slice(0, 200)}`;
}

// Who submitted the completion: the latest submit_completion audit entry,
// falling back to whoever created the request.
async function findSubmitter(row) {
  try {
    const rows = await sql`
      SELECT user_id FROM audit_logs
      WHERE entity_type = 'maintenance_request'
        AND entity_id = ${row.id}
        AND action = 'maintenance.submit_completion'
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows?.[0]?.user_id || row.created_by || null;
  } catch (e) {
    console.error("findSubmitter failed (non-blocking)", e);
    return row.created_by || null;
  }
}

function notifyUser(userId, title, message, requestId) {
  if (!userId) return;
  Promise.resolve()
    .then(() =>
      createNotification({
        user_id: userId,
        title,
        message,
        type: "approval",
        reference_id: requestId,
        reference_type: "maintenance_request",
      }),
    )
    .catch((e) => console.error("createNotification failed (non-blocking)", e));
}

async function bestEffortAudit(entry) {
  try {
    await writeAuditLog(entry);
  } catch (e) {
    console.error(`Failed to write audit log for ${entry.action}`, e);
  }
}

const ALREADY = {
  status: 409,
  body: { error: "This maintenance cost was already processed" },
};

/**
 * Admin approves a pending completion: posts the GL expense exactly as an
 * Admin completion does (Dr 2100 + landlord for 'landlord', Dr 5200 for
 * 'company'; Cr the chosen payment account) and links it via
 * transaction_id. Idempotent: the row is locked and the insert only runs
 * while transaction_id is still NULL.
 */
export async function approveMaintenanceCompletion({ requestId, perm }) {
  const rows =
    await sql`SELECT * FROM maintenance_requests WHERE id = ${requestId} LIMIT 1`;
  const row = rows?.[0] || null;
  if (!row) return { status: 404, body: { error: "Not found" } };
  if (!isPendingCompletion(row)) return ALREADY;

  const amount = Number(row.completed_cost);
  const paymentAccountId = Number(row.payment_account_id);
  const txnDate = ymd(row.completed_date) || new Date().toISOString().slice(0, 10);

  const fundCheck = await ensureCanCreditAccount({
    creditAccountId: paymentAccountId,
    amount,
  });
  if (!fundCheck.ok) return { status: fundCheck.status, body: fundCheck.body };

  let debitAccountId;
  let landlordId = null;
  if (row.charge_type === "landlord") {
    debitAccountId = await getAccountIdByCode("2100");
    if (!debitAccountId) {
      return { status: 500, body: { error: "Account 2100 not configured" } };
    }
    if (!row.property_id) {
      return {
        status: 400,
        body: {
          error: "Maintenance request has no property — cannot charge to landlord",
        },
      };
    }
    const propRows = await sql`
      SELECT landlord_id FROM properties WHERE id = ${row.property_id} LIMIT 1
    `;
    landlordId = Number(propRows?.[0]?.landlord_id) || null;
    if (!landlordId) {
      return { status: 400, body: { error: "Property has no landlord configured" } };
    }
  } else {
    debitAccountId = await getAccountIdByCode("5200");
    if (!debitAccountId) {
      return {
        status: 500,
        body: { error: "Account 5200 (Maintenance Expense) not configured" },
      };
    }
  }

  const description = await maintenanceGlDescription(row);

  const results = await sql.transaction([
    sql(`SELECT id FROM maintenance_requests WHERE id = $1 FOR UPDATE`, [requestId]),
    sql(
      `WITH ins AS (
         INSERT INTO transactions (
           transaction_date, description,
           debit_account_id, credit_account_id,
           amount, currency,
           created_by, landlord_id, property_id,
           expense_scope, source_type, source_id,
           reference_number
         )
         SELECT $1::date, $2::text,
                $3::int, $4::int,
                $5::numeric, 'UGX',
                $6::int, $7::int, $8::int,
                $9::text, 'maintenance', $10::int,
                $11::text
         WHERE EXISTS (
           SELECT 1 FROM maintenance_requests
           WHERE id = $10::int AND ${PENDING_COMPLETION_SQL}
         )
         RETURNING id
       )
       UPDATE maintenance_requests m
       SET transaction_id = ins.id,
           landlord_id = COALESCE($7::int, m.landlord_id)
       FROM ins
       WHERE m.id = $10::int
       RETURNING m.*`,
      [
        txnDate,
        description,
        debitAccountId,
        paymentAccountId,
        amount,
        perm.staff.id,
        landlordId,
        row.property_id || null,
        row.charge_type,
        requestId,
        row.reference_number || null,
      ],
    ),
  ]);

  const updated = results?.[1]?.[0] || null;
  if (!updated) return ALREADY;

  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "maintenance.approve_completion",
    entityType: "maintenance_request",
    entityId: requestId,
    oldValues: row,
    newValues: updated,
    ipAddress: perm.ipAddress,
  });

  const submitter = await findSubmitter(row);
  notifyUser(
    submitter,
    "Maintenance cost approved",
    `The cost for '${row.title || "maintenance job"}' (UGX ${amount.toLocaleString()}) was approved and posted.`,
    requestId,
  );

  return { status: 200, body: { request: updated } };
}

/**
 * Admin rejects a pending completion: clears the pending cost and returns
 * the job to in_progress so it can be corrected and resubmitted. No GL.
 */
export async function rejectMaintenanceCompletion({ requestId, reason, perm }) {
  const rows =
    await sql`SELECT * FROM maintenance_requests WHERE id = ${requestId} LIMIT 1`;
  const row = rows?.[0] || null;
  if (!row) return { status: 404, body: { error: "Not found" } };
  if (!isPendingCompletion(row)) return ALREADY;

  const updatedRows = await sql(
    `UPDATE maintenance_requests
     SET status = 'in_progress',
         completed_at = NULL,
         completed_cost = NULL,
         completed_date = NULL,
         charge_type = NULL,
         payment_account_id = NULL,
         reference_number = NULL
     WHERE id = $1 AND ${PENDING_COMPLETION_SQL}
     RETURNING *`,
    [requestId],
  );
  const updated = updatedRows?.[0] || null;
  if (!updated) return ALREADY;

  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "maintenance.reject_completion",
    entityType: "maintenance_request",
    entityId: requestId,
    oldValues: row,
    newValues: { ...updated, rejected_reason: reason || null },
    ipAddress: perm.ipAddress,
  });

  const submitter = await findSubmitter(row);
  notifyUser(
    submitter,
    "Maintenance cost rejected",
    `The cost for '${row.title || "maintenance job"}' was not approved${reason ? `: ${reason}` : ""}. The job is back in progress.`,
    requestId,
  );

  return { status: 200, body: { request: updated } };
}
