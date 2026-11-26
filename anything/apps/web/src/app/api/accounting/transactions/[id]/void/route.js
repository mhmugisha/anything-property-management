import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";
import { voidPolicyFor } from "@/utils/voidPolicy";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  if (perm.staff.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const txId = toNumber(id);
    if (!txId) return Response.json({ error: "Invalid id" }, { status: 400 });

    const rows = await sql(
      `SELECT * FROM transactions WHERE id = $1 AND COALESCE(is_deleted, false) = false LIMIT 1`,
      [txId],
    );
    const tx = rows?.[0] || null;
    if (!tx) return Response.json({ error: "Transaction not found" }, { status: 404 });

    // Void only soft-deletes this GL row, so it is allowed only where that is
    // a complete undo (manual journals, GL-only entries). Rows that belong to
    // a source record must be undone from that record, or it is orphaned
    // (e.g. a landlord deduction still on the Payment Note).
    const policy = voidPolicyFor(tx);
    if (!policy.ok) {
      return Response.json(
        {
          error: policy.error,
          source_type: policy.sourceType,
          source_id: tx.source_id ?? null,
        },
        { status: 409 },
      );
    }

    // Block voiding of an already-allocated Holding entry — it would orphan
    // the Dr-Holding side of the allocation payment.
    const holdingAccountId = await getAccountIdByCode("2500");
    if (
      holdingAccountId &&
      Number(tx.credit_account_id) === Number(holdingAccountId) &&
      tx.allocated_by_transaction_id !== null &&
      tx.allocated_by_transaction_id !== undefined
    ) {
      return Response.json(
        {
          error:
            "This Holding entry has been allocated; reject the allocation first.",
        },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirm = body?.confirm === true;
    const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

    // Source-linked rows are blocked above, so the old per-source warnings
    // (payout / maintenance / payroll) can no longer apply.
    const warnings = [];

    if (!confirm) {
      return Response.json({
        requires_confirmation: true,
        warnings,
        transaction: {
          id: Number(tx.id),
          date: tx.transaction_date,
          description: tx.description,
          amount: Number(tx.amount),
          source_type: tx.source_type || null,
        },
      });
    }

    await sql(
      `UPDATE transactions
       SET is_deleted = true,
           deleted_at = NOW(),
           deleted_by = $2
       WHERE id = $1`,
      [txId, perm.staff.id],
    );

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transaction.void",
      entityType: "transaction",
      entityId: txId,
      oldValues: { is_deleted: false },
      newValues: { is_deleted: true, deletion_reason: reason },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true, transaction_id: txId });
  } catch (error) {
    console.error("POST /api/accounting/transactions/[id]/void error:", error.message);
    return Response.json({ error: "Failed to void transaction" }, { status: 500 });
  }
}
