import sql from "@/app/api/utils/sql";
import { writeAuditLog } from "@/app/api/utils/staff";

// Duplicate-receipt warning (warn, never block). A payment "looks like" an
// existing one when a NON-reversed payment already exists for the same
// tenant, with the same reference_number (trimmed, case-insensitive) and the
// same amount. Blank reference numbers never match. Different amounts on the
// same receipt (a genuine split across invoices) never match.

/**
 * Run before inserting a payment. Returns:
 *   { blocked: Response }            — duplicate found and not confirmed: return
 *                                      this 409 and insert nothing;
 *   { blocked: null, existingIds }   — go ahead; existingIds is non-empty when
 *                                      the user confirmed past the warning
 *                                      (pass it to logDuplicateOverride after
 *                                      the insert succeeds).
 */
export async function checkDuplicateReceipt({
  tenantId,
  referenceNumber,
  amount,
  confirmDuplicate,
}) {
  const ref = String(referenceNumber ?? "").trim();
  const tenant = Number(tenantId);
  const amt = Number(amount);
  if (!Number.isInteger(tenant) || tenant <= 0 || !ref || !Number.isFinite(amt)) {
    // Diagnostic: a skipped check is otherwise silent.
    console.info("duplicate-receipt check skipped", {
      tenantId: tenantId ?? null,
      hasRef: !!ref,
      amount: amount ?? null,
    });
    return { blocked: null, existingIds: [] };
  }

  const existing = await sql`
    SELECT
      p.id,
      p.payment_date,
      p.amount,
      p.reference_number,
      p.payment_method,
      s.full_name AS recorded_by_name,
      p.created_at
    FROM payments p
    LEFT JOIN staff_users s ON s.id = p.recorded_by
    WHERE p.tenant_id = ${tenant}::int
      AND COALESCE(p.is_reversed, false) = false
      AND LOWER(TRIM(COALESCE(p.reference_number, ''))) = LOWER(${ref}::text)
      AND p.amount = ${amt}::numeric
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 10
  `;

  const existingIds = (existing || []).map((r) => Number(r.id));
  console.info("duplicate-receipt check", {
    tenantId: tenant,
    amount: amt,
    matches: existingIds,
    confirmDuplicate: confirmDuplicate === true,
  });
  if (!existingIds.length) return { blocked: null, existingIds: [] };

  if (confirmDuplicate === true) return { blocked: null, existingIds };

  return {
    blocked: Response.json(
      {
        duplicate: true,
        error: "A payment with this receipt number and amount is already recorded for this tenant.",
        existing: existing.map((r) => ({
          id: Number(r.id),
          payment_date: r.payment_date,
          amount: Number(r.amount),
          reference_number: r.reference_number,
          payment_method: r.payment_method,
          recorded_by_name: r.recorded_by_name || null,
          created_at: r.created_at,
        })),
      },
      { status: 409 },
    ),
    existingIds,
  };
}

/** Audit that the duplicate warning was overridden for a newly inserted payment. */
export async function logDuplicateOverride({
  staffId,
  ipAddress,
  paymentId,
  existingIds,
  referenceNumber,
  amount,
}) {
  if (!existingIds?.length || !paymentId) return;
  try {
    await writeAuditLog({
      staffId,
      action: "payment.duplicate_warning_overridden",
      entityType: "payment",
      entityId: paymentId,
      oldValues: null,
      newValues: {
        existing_payment_ids: existingIds,
        reference_number: referenceNumber,
        amount,
      },
      ipAddress,
    });
  } catch (e) {
    console.error("Failed to write duplicate-override audit log", e);
  }
}
