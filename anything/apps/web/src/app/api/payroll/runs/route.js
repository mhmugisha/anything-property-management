import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const rows = await sql`
      SELECT
        r.id, r.month, r.year, r.status,
        r.total_gross, r.total_deductions, r.total_net,
        r.approved_at, r.created_at,
        COUNT(e.id)::int AS entry_count
      FROM payroll_runs r
      LEFT JOIN payroll_entries e ON e.run_id = r.id
      GROUP BY r.id
      ORDER BY r.year DESC, r.month DESC
    `;

    return Response.json({
      runs: (rows || []).map((r) => ({
        id: Number(r.id),
        month: Number(r.month),
        year: Number(r.year),
        status: r.status,
        total_gross: Number(r.total_gross || 0),
        total_deductions: Number(r.total_deductions || 0),
        total_net: Number(r.total_net || 0),
        approved_at: r.approved_at || null,
        created_at: r.created_at,
        entry_count: Number(r.entry_count || 0),
      })),
    });
  } catch (error) {
    console.error("GET /api/payroll/runs error", error);
    return Response.json({ error: "Failed to fetch payroll runs" }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  if (perm.staff.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const month = toNumber(body?.month);
    const year = toNumber(body?.year);

    if (!month || month < 1 || month > 12) {
      return Response.json({ error: "month must be 1–12" }, { status: 400 });
    }
    if (!year || year < 2020) {
      return Response.json({ error: "year is required (>= 2020)" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM payroll_runs WHERE month = ${month} AND year = ${year} LIMIT 1
    `;
    if (existing.length > 0) {
      return Response.json(
        { error: `A payroll run for ${month}/${year} already exists` },
        { status: 409 },
      );
    }

    const runRows = await sql`
      INSERT INTO payroll_runs (month, year, status, total_gross, total_deductions, total_net, created_by)
      VALUES (${month}, ${year}, 'draft', 0, 0, 0, ${perm.staff.id})
      RETURNING id
    `;
    const runId = Number(runRows[0].id);

    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;

    const employees = await sql`
      SELECT id, payment_method FROM employees WHERE status = 'active' ORDER BY full_name
    `;

    if (employees.length === 0) {
      return Response.json({ success: true, run_id: runId, entry_count: 0 }, { status: 201 });
    }

    let totalGross = 0;
    let totalDeductions = 0;

    for (const emp of employees) {
      const empId = Number(emp.id);

      const salaryRows = await sql(
        `SELECT amount FROM employee_salaries
         WHERE employee_id = $1
           AND effective_date <= $2::date
           AND (end_date IS NULL OR end_date >= $2::date)
         ORDER BY effective_date DESC LIMIT 1`,
        [empId, firstDay],
      );
      const grossPay = salaryRows?.length ? Number(salaryRows[0].amount) : 0;

      const advRows = await sql(
        `SELECT COALESCE(SUM(amount - recovered_amount), 0)::numeric AS total
         FROM employee_advances
         WHERE employee_id = $1
           AND status != 'recovered'
           AND COALESCE(is_voided, false) = false`,
        [empId],
      );
      const advanceDeduction = Math.min(Number(advRows?.[0]?.total || 0), grossPay);

      const loanRows = await sql(
        `SELECT COALESCE(SUM(monthly_instalment), 0)::numeric AS total
         FROM employee_loans WHERE employee_id = $1 AND status = 'active'`,
        [empId],
      );
      const loanDeduction = Math.min(
        Number(loanRows?.[0]?.total || 0),
        Math.max(0, grossPay - advanceDeduction),
      );

      const paye = 0;
      const nssf = 0;
      const netPay = Math.max(0, grossPay - advanceDeduction - loanDeduction - paye - nssf);

      await sql(
        `INSERT INTO payroll_entries
           (run_id, employee_id, gross_pay, advance_deduction, loan_deduction,
            paye, nssf, net_pay, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [runId, empId, grossPay, advanceDeduction, loanDeduction, paye, nssf, netPay, emp.payment_method],
      );

      totalGross += grossPay;
      totalDeductions += advanceDeduction + loanDeduction;
    }

    await sql`
      UPDATE payroll_runs
      SET total_gross = ${totalGross}, total_deductions = ${totalDeductions},
          total_net = ${totalGross - totalDeductions}
      WHERE id = ${runId}
    `;

    return Response.json(
      { success: true, run_id: runId, entry_count: employees.length },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/payroll/runs error", error);
    return Response.json({ error: "Failed to create payroll run" }, { status: 500 });
  }
}
