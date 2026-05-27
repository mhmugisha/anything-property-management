import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const runId = toNumber(params?.id);
    const employeeId = toNumber(params?.employeeId);
    if (!runId || !employeeId) {
      return Response.json({ error: "Invalid run or employee id" }, { status: 400 });
    }

    const runRows = await sql(
      `SELECT id, month, year, status FROM payroll_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    if (!runRows?.length) return Response.json({ error: "Run not found" }, { status: 404 });
    const run = runRows[0];

    const entryRows = await sql(
      `SELECT
         pe.id,
         pe.gross_pay, pe.advance_deduction, pe.loan_deduction,
         pe.paye, pe.nssf, pe.net_pay,
         pe.payment_method, pe.paid_at,
         pe.payment_account_id,
         ca.account_name AS payment_account_name,
         e.full_name, e.position, e.employee_type, e.phone
       FROM payroll_entries pe
       JOIN employees e ON e.id = pe.employee_id
       LEFT JOIN chart_of_accounts ca ON ca.id = pe.payment_account_id
       WHERE pe.run_id = $1 AND pe.employee_id = $2 LIMIT 1`,
      [runId, employeeId],
    );
    if (!entryRows?.length) {
      return Response.json({ error: "Payslip not found" }, { status: 404 });
    }
    const entry = entryRows[0];

    return Response.json({
      company: "Exela Realtors",
      period: `${MONTH_NAMES[Number(run.month)]} ${run.year}`,
      month: Number(run.month),
      year: Number(run.year),
      run_status: run.status,
      employee: {
        full_name: entry.full_name,
        position: entry.position || null,
        employee_type: entry.employee_type,
        phone: entry.phone || null,
      },
      earnings: {
        gross_pay: Number(entry.gross_pay),
      },
      deductions: [
        { label: "Advance Recovery", amount: Number(entry.advance_deduction) },
        { label: "Loan Instalment", amount: Number(entry.loan_deduction) },
        { label: "PAYE Tax", amount: Number(entry.paye) },
        { label: "NSSF", amount: Number(entry.nssf) },
      ],
      net_pay: Number(entry.net_pay),
      payment_method: entry.payment_method,
      payment_account_name: entry.payment_account_name || null,
      paid_at: entry.paid_at || null,
    });
  } catch (error) {
    console.error("GET /api/payroll/runs/[id]/payslip/[employeeId] error", error);
    return Response.json({ error: "Failed to fetch payslip" }, { status: 500 });
  }
}
