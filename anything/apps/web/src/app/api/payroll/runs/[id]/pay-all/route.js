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
    if (!runId) return Response.json({ error: "Invalid run id" }, { status: 400 });

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
    const run = runRows[0];
    if (run.status !== "approved") {
      return Response.json({ error: "Run must be approved before paying" }, { status: 409 });
    }

    const unpaidEntries = await sql(
      `SELECT pe.id, pe.employee_id, pe.net_pay, pe.advance_deduction, pe.loan_deduction
       FROM payroll_entries pe
       WHERE pe.run_id = $1 AND pe.paid_at IS NULL
       ORDER BY pe.id`,
      [runId],
    );

    if (unpaidEntries.length === 0) {
      return Response.json({ success: true, paid_count: 0 });
    }

    const acct2300 = await getAccountIdByCode("2300");
    if (!acct2300) {
      return Response.json({ error: "Salaries Payable account (2300) not configured" }, { status: 500 });
    }

    const ref = `PAY-${run.year}-${String(run.month).padStart(2, "0")}`;
    let paidCount = 0;

    for (const entry of unpaidEntries) {
      const employeeId = Number(entry.employee_id);
      const netPay = Number(entry.net_pay);

      if (netPay > 0) {
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
            `${ref}-EMP${employeeId}`,
            acct2300,
            paymentAccountId,
            netPay,
            perm.staff.id,
            Number(entry.id),
          ],
        );
      }

      await sql(
        `UPDATE payroll_entries SET paid_at = $1::timestamptz, payment_account_id = $2
         WHERE id = $3`,
        [paymentDate, paymentAccountId, Number(entry.id)],
      );

      const advDeduction = Number(entry.advance_deduction);
      if (advDeduction > 0) {
        const advances = await sql(
          `SELECT id, amount, recovered_amount
           FROM employee_advances
           WHERE employee_id = $1 AND status != 'recovered'
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

      paidCount++;
    }

    await sql(`UPDATE payroll_runs SET status = 'paid' WHERE id = $1`, [runId]);

    return Response.json({ success: true, paid_count: paidCount });
  } catch (error) {
    console.error("PUT /api/payroll/runs/[id]/pay-all error", error);
    return Response.json({ error: "Failed to process bulk payment" }, { status: 500 });
  }
}
