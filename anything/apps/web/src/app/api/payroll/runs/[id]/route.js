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
    const runId = toNumber(params?.id);
    if (!runId) return Response.json({ error: "Invalid run id" }, { status: 400 });

    const runRows = await sql(
      `SELECT id, month, year, status, total_gross, total_deductions, total_net,
              approved_by, approved_at, notes, created_at, accrual_transaction_id
       FROM payroll_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    if (!runRows?.length) return Response.json({ error: "Run not found" }, { status: 404 });
    const run = runRows[0];

    const entries = await sql(
      `SELECT
         pe.id,
         pe.employee_id,
         e.full_name AS employee_name,
         e.position,
         e.employee_type,
         e.payment_method,
         pe.gross_pay,
         pe.advance_deduction,
         pe.loan_deduction,
         pe.paye,
         pe.nssf,
         pe.net_pay,
         pe.paid_at,
         pe.payment_account_id,
         ca.account_name AS payment_account_name,
         pe.notes
       FROM payroll_entries pe
       JOIN employees e ON e.id = pe.employee_id
       LEFT JOIN chart_of_accounts ca ON ca.id = pe.payment_account_id
       WHERE pe.run_id = $1
       ORDER BY e.full_name`,
      [runId],
    );

    return Response.json({
      run: {
        id: Number(run.id),
        month: Number(run.month),
        year: Number(run.year),
        status: run.status,
        total_gross: Number(run.total_gross || 0),
        total_deductions: Number(run.total_deductions || 0),
        total_net: Number(run.total_net || 0),
        approved_at: run.approved_at || null,
        created_at: run.created_at,
      },
      entries: (entries || []).map((e) => ({
        id: Number(e.id),
        employee_id: Number(e.employee_id),
        employee_name: e.employee_name,
        position: e.position || null,
        employee_type: e.employee_type,
        payment_method: e.payment_method,
        gross_pay: Number(e.gross_pay),
        advance_deduction: Number(e.advance_deduction),
        loan_deduction: Number(e.loan_deduction),
        paye: Number(e.paye),
        nssf: Number(e.nssf),
        net_pay: Number(e.net_pay),
        paid_at: e.paid_at || null,
        payment_account_id: e.payment_account_id ? Number(e.payment_account_id) : null,
        payment_account_name: e.payment_account_name || null,
        notes: e.notes || null,
      })),
    });
  } catch (error) {
    console.error("GET /api/payroll/runs/[id] error", error);
    return Response.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
