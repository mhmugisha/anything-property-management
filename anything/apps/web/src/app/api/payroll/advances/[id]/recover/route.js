import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

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

  try {
    const advanceId = toNumber(params?.id);
    if (!advanceId) {
      return Response.json({ error: "Invalid advance id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const recoveryAmount = toNumber(body?.amount);
    const debitAccountId = toNumber(body?.debit_account_id);
    const recoveryDate =
      parseDate(body?.recovery_date) || new Date().toISOString().slice(0, 10);

    if (!recoveryAmount || recoveryAmount <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!debitAccountId) {
      return Response.json(
        { error: "debit_account_id is required (e.g. Salaries Payable 2300 or cash account)" },
        { status: 400 },
      );
    }

    const advanceRows = await sql(
      `SELECT a.id, a.employee_id, a.amount, a.recovered_amount, a.status,
              a.is_voided,
              e.full_name AS employee_name
       FROM employee_advances a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.id = $1 LIMIT 1`,
      [advanceId],
    );

    const advance = advanceRows?.[0] || null;
    if (!advance) {
      return Response.json({ error: "Advance not found" }, { status: 404 });
    }
    if (advance.is_voided === true) {
      return Response.json({ error: "Advance is voided" }, { status: 400 });
    }
    if (advance.status === "recovered") {
      return Response.json({ error: "Advance already fully recovered" }, { status: 400 });
    }

    const outstanding = Number(advance.amount) - Number(advance.recovered_amount);
    if (recoveryAmount > outstanding) {
      return Response.json(
        { error: `Recovery amount (${recoveryAmount}) exceeds outstanding balance (${outstanding})` },
        { status: 400 },
      );
    }

    const staffAdvancesAcctId = await getAccountIdByCode("1400");
    if (!staffAdvancesAcctId) {
      return Response.json({ error: "Staff Advances account (1400) not configured" }, { status: 500 });
    }

    const newRecovered = Number(advance.recovered_amount) + recoveryAmount;
    const newOutstanding = Number(advance.amount) - newRecovered;
    const newStatus =
      newOutstanding <= 0 ? "recovered" : newRecovered > 0 ? "partial" : "outstanding";

    // GL: Dr debit_account_id / Cr 1400 Staff Advances
    const txnRows = await sql(
      `INSERT INTO transactions (
         transaction_date, description, reference_number,
         debit_account_id, credit_account_id,
         amount, currency, created_by,
         source_type, source_id, approval_status
       ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'advance_recovery', $8, 'approved')
       RETURNING id`,
      [
        recoveryDate,
        `Advance recovery - ${advance.employee_name}`,
        `ADV-REC-${advanceId}-${Date.now()}`,
        debitAccountId,
        staffAdvancesAcctId,
        recoveryAmount,
        perm.staff.id,
        advanceId,
      ],
    );
    const transactionId = Number(txnRows[0].id);

    await sql(
      `UPDATE employee_advances
       SET recovered_amount = $1, status = $2
       WHERE id = $3`,
      [newRecovered, newStatus, advanceId],
    );

    return Response.json({
      success: true,
      advance_id: advanceId,
      recovery_amount: recoveryAmount,
      new_recovered_total: newRecovered,
      outstanding_after: Math.max(0, newOutstanding),
      status: newStatus,
      transaction_id: transactionId,
    });
  } catch (error) {
    console.error("PUT /api/payroll/advances/[id]/recover error", error);
    return Response.json({ error: "Failed to record recovery" }, { status: 500 });
  }
}
