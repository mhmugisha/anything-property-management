import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const employeeId = toNumber(params?.id);
    if (!employeeId) {
      return Response.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();
    const fromDate = searchParams.get("from_date") || `${year}-01-01`;
    const toDate = searchParams.get("to_date") || today;

    const empRows = await sql(
      `SELECT id, full_name, position, employee_type FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );
    if (!empRows?.length) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }
    const employee = empRows[0];

    // Payroll entries (salary accrual + salary payment)
    const payrollRows = await sql(
      `SELECT
         pe.gross_pay, pe.advance_deduction, pe.loan_deduction, pe.net_pay,
         pe.paid_at,
         pr.month, pr.year, pr.status AS run_status,
         pr.approved_at
       FROM payroll_entries pe
       JOIN payroll_runs pr ON pr.id = pe.run_id
       WHERE pe.employee_id = $1
         AND pr.status IN ('approved', 'paid')
         AND pr.approved_at::date BETWEEN $2::date AND $3::date
       ORDER BY pr.approved_at ASC`,
      [employeeId, fromDate, toDate],
    );

    // Advances
    const advanceRows = await sql(
      `SELECT id, amount, advance_date, description, recovered_amount, status
       FROM employee_advances
       WHERE employee_id = $1
         AND advance_date::date BETWEEN $2::date AND $3::date
         AND COALESCE(is_voided, false) = false
       ORDER BY advance_date ASC`,
      [employeeId, fromDate, toDate],
    );

    // Loans
    const loanRows = await sql(
      `SELECT id, amount, issue_date, description, monthly_instalment,
              paid_instalments, recovered_amount, status
       FROM employee_loans
       WHERE employee_id = $1
         AND issue_date::date BETWEEN $2::date AND $3::date
       ORDER BY issue_date ASC`,
      [employeeId, fromDate, toDate],
    );

    const rows = [];

    for (const r of payrollRows || []) {
      const monthStr = String(r.month).padStart(2, "0");
      const period = `${r.year}-${monthStr}`;
      // Salary accrual (credit — money owed to employee)
      rows.push({
        date: r.approved_at ? r.approved_at.toISOString().slice(0, 10) : `${r.year}-${monthStr}-01`,
        description: `Salary accrual — ${period}`,
        type: "salary_accrual",
        debit: 0,
        credit: Number(r.gross_pay),
      });
      // Advance recovery deduction (debit — reduces what's owed)
      if (Number(r.advance_deduction) > 0) {
        rows.push({
          date: r.approved_at ? r.approved_at.toISOString().slice(0, 10) : `${r.year}-${monthStr}-01`,
          description: `Advance recovery — ${period}`,
          type: "advance_recovery",
          debit: Number(r.advance_deduction),
          credit: 0,
        });
      }
      // Loan instalment deduction
      if (Number(r.loan_deduction) > 0) {
        rows.push({
          date: r.approved_at ? r.approved_at.toISOString().slice(0, 10) : `${r.year}-${monthStr}-01`,
          description: `Loan instalment — ${period}`,
          type: "loan_recovery",
          debit: Number(r.loan_deduction),
          credit: 0,
        });
      }
      // Salary payment
      if (r.paid_at) {
        rows.push({
          date: r.paid_at.toISOString().slice(0, 10),
          description: `Salary payment — ${period}`,
          type: "salary_payment",
          debit: Number(r.net_pay),
          credit: 0,
        });
      }
    }

    for (const r of advanceRows || []) {
      const date = r.advance_date instanceof Date
        ? r.advance_date.toISOString().slice(0, 10)
        : String(r.advance_date).slice(0, 10);
      rows.push({
        date,
        description: r.description ? `Advance — ${r.description}` : "Advance given",
        type: "advance_given",
        debit: 0,
        credit: Number(r.amount),
      });
    }

    for (const r of loanRows || []) {
      const date = r.issue_date instanceof Date
        ? r.issue_date.toISOString().slice(0, 10)
        : String(r.issue_date).slice(0, 10);
      rows.push({
        date,
        description: r.description ? `Loan — ${r.description}` : "Loan given",
        type: "loan_given",
        debit: 0,
        credit: Number(r.amount),
      });
    }

    // Sort by date ASC
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Compute running balance (credit = employee owes us money / we gave them; debit = we paid them)
    // Convention: credit items increase the balance (we owe or gave), debit items decrease it
    let balance = 0;
    const rowsWithBalance = rows.map((r) => {
      balance = balance + r.credit - r.debit;
      return { ...r, balance };
    });

    const totalCredited = rows.reduce((s, r) => s + r.credit, 0);
    const totalDebited = rows.reduce((s, r) => s + r.debit, 0);

    return Response.json({
      employee: {
        id: Number(employee.id),
        full_name: employee.full_name,
        position: employee.position || null,
        employee_type: employee.employee_type,
      },
      from_date: fromDate,
      to_date: toDate,
      rows: rowsWithBalance,
      closing_balance: balance,
      total_credited: totalCredited,
      total_debited: totalDebited,
    });
  } catch (error) {
    console.error("GET /api/payroll/employees/[id]/statement error", error);
    return Response.json({ error: "Failed to fetch statement" }, { status: 500 });
  }
}
