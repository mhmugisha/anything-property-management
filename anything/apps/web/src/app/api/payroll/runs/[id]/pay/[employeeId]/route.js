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
  if (perm.staff.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const runId = toNumber(params?.id);
    const employeeId = toNumber(params?.employeeId);
    if (!runId || !employeeId) {
      return Response.json({ error: "Invalid run or employee id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentAccountId = toNumber(body?.payment_account_id);
    const paymentDate = parseDate(body?.payment_date) || new Date().toISOString().slice(0, 10);

    if (!paymentAccountId) {
      return Response.json({ error: "payment_account_id is required" }, { status: 400 });
    }

    const runRows = await sql(
      `SELECT id, month, year, status FROM payroll_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    if (!runRows?.length) return Response.json({ error: "Run not found" }, { status: 404 });
    if (runRows[0].status !== "approved") {
      return Response.json({ error: "Run must be approved before paying" }, { status: 409 });
    }

    const entryRows = await sql(
      `SELECT id, net_pay, advance_deduction, loan_deduction, paid_at
       FROM payroll_entries WHERE run_id = $1 AND employee_id = $2 LIMIT 1`,
      [runId, employeeId],
    );
    if (!entryRows?.length) {
      return Response.json({ error: "Entry not found for this employee in this run" }, { status: 404 });
    }
    const entry = entryRows[0];
    if (entry.paid_at) {
      return Response.json({ error: "Employee already paid for this run" }, { status: 409 });
    }

    const netPay = Number(entry.net_pay);

    // GL: Dr 2300 Salaries Payable / Cr payment account (net_pay)
    if (netPay > 0) {
      const acct2300 = await getAccountIdByCode("2300");
      if (!acct2300) {
        return Response.json({ error: "Salaries Payable account (2300) not configured" }, { status: 500 });
      }
      const run = runRows[0];
      await sql(
        `INSERT INTO transactions (
           transaction_date, description, reference_number,
           debit_account_id, credit_account_id,
           amount, currency, created_by,
           source_type, source_id, approval_status
         ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'payroll_payment', $8, 'approved')`,
        [
          paymentDate,
          `Salary payment — employee #${employeeId}`,
          `PAY-${run.year}-${String(run.month).padStart(2, "0")}-EMP${employeeId}`,
          acct2300,
          paymentAccountId,
          netPay,
          perm.staff.id,
          Number(entry.id),
        ],
      );
    }

    // Mark entry as paid
    await sql(
      `UPDATE payroll_entries SET paid_at = $1::timestamptz, payment_account_id = $2
       WHERE run_id = $3 AND employee_id = $4`,
      [paymentDate, paymentAccountId, runId, employeeId],
    );

    // Apply advance deduction to outstanding advances (oldest first)
    const advDeduction = Number(entry.advance_deduction);
    if (advDeduction > 0) {
      const advances = await sql(
        `SELECT id, amount, recovered_amount
         FROM employee_advances
         WHERE employee_id = $1
           AND status != 'recovered'
           AND COALESCE(is_voided, false) = false
         ORDER BY advance_date ASC`,
        [employeeId],
      );
      let remaining = advDeduction;
      for (const adv of advances) {
        if (remaining <= 0) break;
        const outstanding = Number(adv.amount) - Number(adv.recovered_amount);
        const apply = Math.min(remaining, outstanding);
        const newRecovered = Number(adv.recovered_amount) + apply;
        const newStatus = newRecovered >= Number(adv.amount) ? "recovered" : "partial";
        await sql(
          `UPDATE employee_advances SET recovered_amount = $1, status = $2 WHERE id = $3`,
          [newRecovered, newStatus, Number(adv.id)],
        );
        remaining -= apply;
      }
    }

    // Apply loan deduction — one instalment per active loan
    const loanDeduction = Number(entry.loan_deduction);
    if (loanDeduction > 0) {
      const loans = await sql(
        `SELECT id, amount, monthly_instalment, paid_instalments, recovered_amount
         FROM employee_loans WHERE employee_id = $1 AND status = 'active'`,
        [employeeId],
      );
      for (const loan of loans) {
        const newRecovered = Number(loan.recovered_amount) + Number(loan.monthly_instalment);
        const newPaid = Number(loan.paid_instalments) + 1;
        const newStatus = newRecovered >= Number(loan.amount) ? "completed" : "active";
        await sql(
          `UPDATE employee_loans
           SET recovered_amount = $1, paid_instalments = $2, status = $3 WHERE id = $4`,
          [newRecovered, newPaid, newStatus, Number(loan.id)],
        );
      }
    }

    // Check if all entries are now paid → update run status
    const unpaidRows = await sql(
      `SELECT COUNT(*)::int AS cnt FROM payroll_entries WHERE run_id = $1 AND paid_at IS NULL`,
      [runId],
    );
    if (Number(unpaidRows?.[0]?.cnt || 0) === 0) {
      await sql(`UPDATE payroll_runs SET status = 'paid' WHERE id = $1`, [runId]);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("PUT /api/payroll/runs/[id]/pay/[employeeId] error", error);
    return Response.json({ error: "Failed to process payment" }, { status: 500 });
  }
}
