import sql from "@/app/api/utils/sql";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";
import { autoApplyAdvancePaymentsForTenant } from "@/app/api/utils/payments/autoApply";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";
import { writeAuditLog } from "@/app/api/utils/staff";

// Shared "advance-style payment" pipeline: lease lookup -> INSERT payments
// -> GL post (with rollback on failure) -> audit log -> notifications
// -> auto-apply to open invoices. Extracted from CASE B of POST /api/payments
// so other flows (e.g. allocate-to-holding) can reuse the exact same
// choreography while varying only the pieces below.
export async function recordAdvancePayment({
  staff,
  ipAddress,
  tenantId,
  propertyId,
  paymentDate,
  amount,
  paymentMethod,
  referenceNumber,
  notes,
  description,
  debitIntent,
  creditIntent = "tenant_prepayments",
  sourceType,
  businessEvent = "TENANT_ADVANCE_PAYMENT_RECEIVED",
  labels,
}) {
  const leaseRows = await sql`
    SELECT
      l.id AS lease_id,
      l.currency,
      t.full_name AS tenant_name,
      p.property_name,
      p.landlord_id
    FROM leases l
    JOIN tenants t ON t.id = l.tenant_id
    JOIN units u ON u.id = l.unit_id
    JOIN properties p ON p.id = u.property_id
    WHERE l.tenant_id = ${tenantId}
      AND p.id = ${propertyId}
      AND l.status IN ('active', 'ended')
    ORDER BY l.start_date DESC, l.id DESC
    LIMIT 1
  `;

  const lease = leaseRows?.[0] || null;

  if (!lease) {
    return {
      ok: false,
      status: 400,
      error:
        "No active lease found for this tenant in the selected property",
    };
  }

  // STEP 1: Insert payment row.
  const approval = getApprovalFields(staff);
  let payment;
  try {
    const paymentRows = await sql`
      INSERT INTO payments (
        lease_id, tenant_id, property_id,
        payment_date, amount, currency, payment_method,
        reference_number,
        recorded_by, notes,
        period_month, period_year,
        description,
        approval_status, approved_by, approved_at
      )
      VALUES (
        ${lease.lease_id}, ${tenantId}, ${propertyId},
        ${paymentDate}::date, ${amount}, ${lease.currency || "UGX"}, ${paymentMethod},
        ${referenceNumber},
        ${staff.id}, ${notes},
        NULL, NULL,
        ${description},
        ${approval.approval_status}, ${approval.approved_by}, ${approval.approved_at}
      )
      RETURNING *
    `;
    payment = paymentRows?.[0] || null;
  } catch (insertErr) {
    return {
      ok: false,
      status: 500,
      error: `Payment creation failed: ${insertErr.message}`,
    };
  }

  if (!payment) {
    return {
      ok: false,
      status: 500,
      error: "Payment creation returned no row",
    };
  }

  // STEP 2: Post accounting. If it fails, delete the payment row to avoid an orphan.
  const glDesc = `${labels.flow} - ${lease.tenant_name || "Tenant"} - ${lease.property_name}`;

  const post = await postAccountingEntryFromIntents({
    transactionDate: paymentDate,
    description: glDesc,
    referenceNumber: referenceNumber,
    debitIntent,
    creditIntent,
    amount: amount,
    currency: lease.currency || "UGX",
    createdBy: staff.id,
    landlordId: lease.landlord_id || null,
    propertyId: propertyId,
    sourceType,
    sourceId: payment.id,
    approvalStatus: getApprovalStatus(staff),
    auditContext: {
      sourceModule: "property",
      businessEvent,
      sourceEntity: { type: "payment", id: payment.id },
    },
  });

  if (!post.ok) {
    try {
      await sql`DELETE FROM payments WHERE id = ${payment.id}`;
    } catch (rollbackErr) {
      console.error(
        "CRITICAL: GL post failed AND payment delete failed. Manual cleanup required.",
        {
          paymentId: payment.id,
          glError: post.error,
          rollbackError: rollbackErr.message,
        },
      );
    }
    return {
      ok: false,
      status: 500,
      error: `Accounting posting failed; payment was rolled back: ${post.error || "unknown error"}`,
    };
  }

  await writeAuditLog({
    staffId: staff.id,
    action: "payment.create",
    entityType: "payment",
    entityId: payment?.id || null,
    oldValues: null,
    newValues: payment,
    ipAddress,
  });

  const flowLower = labels.flow.toLowerCase();
  notifyAllAdminsAsync({
    title: `${labels.flow} Received`,
    message: `New ${flowLower} of ${lease.currency || "UGX"} ${Number(amount).toLocaleString()} received from ${lease.tenant_name || "Tenant"} at ${lease.property_name}. Recorded by ${staff.full_name || "Staff"}`,
    type: "payment",
    reference_id: payment.id,
    reference_type: "payment",
  });

  if (approval.approval_status === "pending") {
    const pendingLower = labels.pending.toLowerCase();
    notifyAllAdminsAsync({
      title: `New ${labels.pending} Pending Approval`,
      message: `New ${pendingLower} of ${lease.currency || "UGX"} ${Number(amount).toLocaleString()} from ${lease.tenant_name || "Tenant"} at ${lease.property_name} is pending approval. Recorded by ${staff.full_name || "Staff"}`,
      type: "payment",
      reference_id: payment.id,
      reference_type: "payment",
    });
  }

  // ENHANCEMENT: Immediately auto-apply advance payment to outstanding invoices
  let autoApplyResult = null;
  try {
    autoApplyResult = await autoApplyAdvancePaymentsForTenant(tenantId);
    if (!autoApplyResult.ok) {
      console.error("Auto-apply failed:", autoApplyResult.error);
    }
  } catch (e) {
    console.error("Error during auto-apply:", e);
    // Don't fail the payment creation if auto-apply fails
  }

  return {
    ok: true,
    payment,
    autoApplyResult,
  };
}
