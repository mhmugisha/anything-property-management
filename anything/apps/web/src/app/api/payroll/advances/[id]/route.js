import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  if (perm.staff.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const advanceId = toNumber(params?.id);
    if (!advanceId) {
      return Response.json({ error: "Invalid advance id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const newAmount = toNumber(body?.amount);
    const newDate = parseDate(body?.advance_date);
    const newDescription =
      body?.description === undefined || body?.description === null
        ? undefined
        : String(body.description).trim() || null;

    if (!newAmount || newAmount <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!newDate) {
      return Response.json({ error: "advance_date must be YYYY-MM-DD" }, { status: 400 });
    }

    const rows = await sql(
      `SELECT a.id, a.employee_id, a.amount, a.advance_date, a.description,
              a.recovered_amount, a.status, a.is_voided,
              a.transaction_id, a.payment_account_id,
              e.full_name AS employee_name
       FROM employee_advances a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.id = $1 LIMIT 1`,
      [advanceId],
    );
    const advance = rows?.[0] || null;
    if (!advance) {
      return Response.json({ error: "Advance not found" }, { status: 404 });
    }

    if (advance.is_voided === true || Number(advance.recovered_amount || 0) !== 0) {
      return Response.json(
        {
          error:
            "This advance has repayments and cannot be edited; void and recreate instead.",
        },
        { status: 409 },
      );
    }

    const txId = advance.transaction_id ? Number(advance.transaction_id) : null;
    if (!txId) {
      return Response.json(
        { error: "Advance is missing its GL entry; cannot edit safely" },
        { status: 500 },
      );
    }

    const oldValues = {
      amount: Number(advance.amount),
      advance_date: advance.advance_date,
      description: advance.description,
    };
    const newValues = {
      amount: newAmount,
      advance_date: newDate,
      description:
        newDescription === undefined ? advance.description : newDescription,
    };

    // Because the advance is UNTOUCHED (recovered_amount = 0), nothing else
    // references its GL row — update it in place to keep the ledger balanced.
    // Original posting: Dr 1400 Staff Advances / Cr payment_account_id for amount.
    await sql.transaction((txn) => [
      txn`
        UPDATE employee_advances
        SET amount = ${newAmount},
            advance_date = ${newDate}::date,
            description = ${newValues.description}
        WHERE id = ${advanceId}
      `,
      txn`
        UPDATE transactions
        SET amount = ${newAmount},
            transaction_date = ${newDate}::date,
            description = ${`Staff advance - ${advance.employee_name}`}
        WHERE id = ${txId}
          AND source_type = 'staff_advance'
          AND COALESCE(is_deleted, false) = false
      `,
    ]);

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "payroll.advance.edit",
      entityType: "employee_advance",
      entityId: advanceId,
      oldValues,
      newValues: { ...newValues, gl_transaction_id: txId },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      success: true,
      advance_id: advanceId,
      transaction_id: txId,
      amount: newAmount,
      advance_date: newDate,
    });
  } catch (error) {
    console.error("PUT /api/payroll/advances/[id] error:", error);
    return Response.json({ error: "Failed to edit advance" }, { status: 500 });
  }
}
