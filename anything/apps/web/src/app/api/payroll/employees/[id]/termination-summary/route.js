import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { computeTerminationSettlement } from "@/app/api/utils/payroll/computeTerminationSettlement";

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
    const terminationDate = searchParams.get("termination_date");

    if (!terminationDate || !/^\d{4}-\d{2}-\d{2}$/.test(terminationDate)) {
      return Response.json({ error: "termination_date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const empRows = await sql(
      `SELECT id, full_name FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );
    const employee = empRows?.[0];
    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const settlement = await computeTerminationSettlement({ employeeId, terminationDate });

    const advRows = await sql(
      `SELECT COALESCE(SUM(amount - COALESCE(recovered_amount, 0)), 0)::numeric AS total
       FROM employee_advances
       WHERE employee_id = $1
         AND status != 'recovered'
         AND COALESCE(is_voided, false) = false`,
      [employeeId],
    );
    const outstandingAdvances = Number(advRows?.[0]?.total || 0);

    const loanRows = await sql(
      `SELECT COALESCE(SUM(amount - recovered_amount), 0)::numeric AS total
       FROM employee_loans WHERE employee_id = $1 AND status != 'fully_paid'`,
      [employeeId],
    );
    const outstandingLoans = Number(loanRows?.[0]?.total || 0);

    const grossSalary = settlement.total_gross;
    const paye = 0;
    const nssf = 0;
    const netBeforeAdvances = grossSalary - paye - nssf;
    const netPayable = netBeforeAdvances - outstandingAdvances - outstandingLoans;
    const shortfall = netPayable < 0 ? Math.abs(netPayable) : 0;

    return Response.json({
      employee_id: Number(employee.id),
      full_name: employee.full_name,
      termination_date: terminationDate,
      gross_salary: grossSalary,
      paye,
      nssf,
      net_before_advances: netBeforeAdvances,
      outstanding_advances: outstandingAdvances,
      outstanding_loans: outstandingLoans,
      net_payable: netPayable,
      shortfall,
      settlement_breakdown: settlement.line_items,
      last_paid_year: settlement.last_paid_year,
      last_paid_month: settlement.last_paid_month,
    });
  } catch (error) {
    console.error("GET /api/payroll/employees/[id]/termination-summary error:", error.message);
    return Response.json({ error: "Failed to compute termination summary" }, { status: 500 });
  }
}
