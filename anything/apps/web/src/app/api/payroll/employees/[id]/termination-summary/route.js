import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function computePaye(gross) {
  // Match existing payroll run logic — currently 0
  return 0;
}

function computeNssf(gross) {
  return Math.round(gross * 0.05);
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
    const salaryType = searchParams.get("salary_type") || "full";

    if (!terminationDate || !/^\d{4}-\d{2}-\d{2}$/.test(terminationDate)) {
      return Response.json({ error: "termination_date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!["full", "prorated"].includes(salaryType)) {
      return Response.json({ error: "salary_type must be 'full' or 'prorated'" }, { status: 400 });
    }

    const empRows = await sql(
      `SELECT id, full_name FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );
    const employee = empRows?.[0];
    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const salaryRows = await sql(
      `SELECT amount FROM employee_salaries
       WHERE employee_id = $1
         AND effective_date <= $2::date
       ORDER BY effective_date DESC
       LIMIT 1`,
      [employeeId, terminationDate],
    );
    const monthlySalary = salaryRows?.length ? Number(salaryRows[0].amount) : 0;

    const termDate = new Date(terminationDate);
    const year = termDate.getUTCFullYear();
    const month = termDate.getUTCMonth() + 1;
    const dayOfMonth = termDate.getUTCDate();
    const totalDaysInMonth = daysInMonth(year, month);

    let grossSalary;
    if (salaryType === "prorated") {
      grossSalary = Math.round((monthlySalary / totalDaysInMonth) * dayOfMonth);
    } else {
      grossSalary = monthlySalary;
    }

    const paye = computePaye(grossSalary);
    const nssf = computeNssf(grossSalary);
    const netBeforeAdvances = grossSalary - paye - nssf;

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
       FROM employee_loans
       WHERE employee_id = $1 AND status != 'fully_paid'`,
      [employeeId],
    );
    const outstandingLoans = Number(loanRows?.[0]?.total || 0);

    const netPayable = netBeforeAdvances - outstandingAdvances - outstandingLoans;
    const shortfall = netPayable < 0 ? Math.abs(netPayable) : 0;

    return Response.json({
      employee_id: Number(employee.id),
      full_name: employee.full_name,
      termination_date: terminationDate,
      monthly_salary: monthlySalary,
      salary_type: salaryType,
      days_in_month: totalDaysInMonth,
      days_worked: dayOfMonth,
      gross_salary: grossSalary,
      paye,
      nssf,
      net_before_advances: netBeforeAdvances,
      outstanding_advances: outstandingAdvances,
      outstanding_loans: outstandingLoans,
      net_payable: netPayable,
      shortfall,
    });
  } catch (error) {
    console.error("GET /api/payroll/employees/[id]/termination-summary error:", error.message);
    return Response.json({ error: "Failed to compute termination summary" }, { status: 500 });
  }
}
