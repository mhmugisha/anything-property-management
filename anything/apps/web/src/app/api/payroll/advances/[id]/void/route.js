import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request, { params: { id } }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  if (perm.staff.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const advanceId = toNumber(id);
    if (!advanceId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() || null : null;

    const rows = await sql(
      `SELECT id, employee_id, amount, recovered_amount, status,
              transaction_id, is_voided
       FROM employee_advances
       WHERE id = $1
       LIMIT 1`,
      [advanceId],
    );
    const advance = rows?.[0] || null;
    if (!advance) {
      return Response.json({ error: "Advance not found" }, { status: 404 });
    }

    if (advance.is_voided === true) {
      return Response.json({ error: "Advance already voided" }, { status: 400 });
    }

    if (Number(advance.recovered_amount || 0) !== 0) {
      return Response.json(
        {
          error:
            "Cannot void an advance that has been partially or fully recovered — use the recovery flow",
        },
        { status: 400 },
      );
    }

    const txId = advance.transaction_id ? Number(advance.transaction_id) : null;

    // One transaction: soft-delete the linked GL row (if any) and flag the advance.
    await sql.transaction((txn) => {
      const ops = [];
      if (txId) {
        ops.push(txn`
          UPDATE transactions
          SET is_deleted = true,
              deleted_at = NOW(),
              deleted_by = ${perm.staff.id}
          WHERE id = ${txId}
            AND source_type = 'staff_advance'
            AND COALESCE(is_deleted, false) = false
        `);
      }
      ops.push(txn`
        UPDATE employee_advances
        SET is_voided = true,
            voided_at = NOW(),
            voided_by = ${perm.staff.id}
        WHERE id = ${advanceId}
      `);
      return ops;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "payroll.advance.void",
      entityType: "employee_advance",
      entityId: advanceId,
      oldValues: {
        is_voided: false,
        recovered_amount: Number(advance.recovered_amount || 0),
        transaction_id: txId,
      },
      newValues: {
        is_voided: true,
        gl_transaction_soft_deleted: !!txId,
        reason,
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      success: true,
      advance_id: advanceId,
      transaction_id: txId,
    });
  } catch (error) {
    console.error("POST /api/payroll/advances/[id]/void error:", error);
    return Response.json({ error: "Failed to void advance" }, { status: 500 });
  }
}
