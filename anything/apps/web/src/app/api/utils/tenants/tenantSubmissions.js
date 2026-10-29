import sql from "@/app/api/utils/sql";
import { writeAuditLog } from "@/app/api/utils/staff";
import { getApprovalFields } from "@/app/api/utils/approval";
import { createNotification } from "@/app/api/utils/notifications";
import { materializeTenantWithLease } from "@/app/api/utils/tenants/materializeTenantWithLease";
import { ensureInvoicesForNewLease } from "@/app/api/utils/tenants/leaseInvoices";

function ymd(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function notifyRequester(submission, title, message) {
  try {
    createNotification({
      user_id: submission.requested_by,
      title,
      message,
      type: "approval",
      reference_id: submission.id,
      reference_type: "tenant_submission",
    });
  } catch (notifError) {
    console.error("createNotification failed (non-blocking)", notifError);
  }
}

async function bestEffortAudit(entry) {
  try {
    await writeAuditLog(entry);
  } catch (e) {
    console.error(`Failed to write audit log for ${entry.action}`, e);
  }
}

/**
 * Approve: create the real tenant, lease, unit occupancy and deposit from the
 * submission in one statement (the submission DELETE is the claim), then
 * invoices. Returns { status, body }.
 */
export async function approveTenantSubmission({ submissionId, perm }) {
  const before = await sql`
    SELECT * FROM tenant_submissions WHERE id = ${submissionId} LIMIT 1
  `;
  const submission = before?.[0] || null;
  if (!submission) {
    return { status: 409, body: { error: "This submission was already processed" } };
  }

  const created = await materializeTenantWithLease({
    submissionId,
    approval: getApprovalFields(perm.staff),
    unitId: submission.unit_id,
  });

  if (!created) {
    const still = await sql`
      SELECT id FROM tenant_submissions WHERE id = ${submissionId} LIMIT 1
    `;
    if (still.length === 0) {
      return { status: 409, body: { error: "This submission was already processed" } };
    }
    // Overlap or archived property: leave the submission pending.
    return {
      status: 409,
      body: {
        error:
          "Unit no longer available for these dates. The submission is still pending.",
      },
    };
  }

  const { tenant, lease } = created;

  const { invoiceInsertedCount, invoiceWarning } =
    await ensureInvoicesForNewLease(lease.id, ymd(submission.start_date));

  // tenant/lease are recorded as created by the requester; the approval by the admin.
  await bestEffortAudit({
    staffId: submission.requested_by,
    action: "tenant.create",
    entityType: "tenant",
    entityId: tenant?.id || null,
    oldValues: null,
    newValues: tenant,
    ipAddress: perm.ipAddress,
  });
  await bestEffortAudit({
    staffId: submission.requested_by,
    action: "lease.create",
    entityType: "lease",
    entityId: lease?.id || null,
    oldValues: null,
    newValues: lease,
    ipAddress: perm.ipAddress,
  });
  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "approval.approve",
    entityType: "tenant_submission",
    entityId: submissionId,
    oldValues: { submission },
    newValues: { tenant_id: tenant?.id || null, lease_id: lease?.id || null },
    ipAddress: perm.ipAddress,
  });

  notifyRequester(
    submission,
    "Tenant Approved",
    `The tenant '${submission.full_name}' you submitted has been approved and is now active.`,
  );

  return {
    status: 200,
    body: {
      ok: true,
      action: "approve",
      tenant,
      lease,
      invoiceInsertedCount: invoiceInsertedCount ?? null,
      ...(invoiceWarning
        ? { warning: `Invoices were not generated yet: ${invoiceWarning}` }
        : {}),
    },
  };
}

/**
 * Reject: delete the submission. Nothing was ever written to live data, so
 * there is nothing to unwind. The reason lives in the audit log and the
 * requester's notification. Returns { status, body }.
 */
export async function rejectTenantSubmission({ submissionId, reason, perm }) {
  const rows = await sql`
    DELETE FROM tenant_submissions WHERE id = ${submissionId} RETURNING *
  `;
  const submission = rows?.[0] || null;
  if (!submission) {
    return { status: 409, body: { error: "This submission was already processed" } };
  }

  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "approval.reject",
    entityType: "tenant_submission",
    entityId: submissionId,
    oldValues: { submission },
    newValues: { rejected_reason: reason || null },
    ipAddress: perm.ipAddress,
  });

  notifyRequester(
    submission,
    "Entry Not Approved",
    `The tenant '${submission.full_name}' you submitted has not been approved.${
      reason ? ` Reason: ${reason}` : ""
    } Please contact admin.`,
  );

  return { status: 200, body: { ok: true, action: "reject" } };
}
