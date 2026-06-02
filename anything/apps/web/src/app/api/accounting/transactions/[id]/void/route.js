import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

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

    const body = await request.json().catch(() => ({}));
    const confirm = body?.confirm === true;
    const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

    // Build warnings based on source_type
    const warnings = [];
    const src = tx.source_type || "";
    if (src === "landlord_payout") {
      warnings.push("This transaction is linked to a landlord payout. Voiding it will affect the landlord's balance.");
    } else if (src === "maintenance") {
      warnings.push(`This transaction is linked to maintenance request #${tx.source_id}. The GL entry will be removed but the maintenance record will remain.`);
    } else if (["payroll", "payroll_advance", "payroll_loan", "termination"].includes(src)) {
      warnings.push("This transaction is part of a payroll run. Voiding may cause payroll records to be inconsistent.");
    }

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
