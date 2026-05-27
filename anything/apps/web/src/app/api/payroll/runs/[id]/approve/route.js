import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

    const runRows = await sql(
      `SELECT id, month, year, status FROM payroll_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    if (!runRows?.length) return Response.json({ error: "Run not found" }, { status: 404 });
    const run = runRows[0];
    if (run.status !== "draft") {
      return Response.json({ error: "Only draft runs can be approved" }, { status: 409 });
    }

    const totals = await sql(
      `SELECT
         COALESCE(SUM(gross_pay), 0)::numeric AS total_gross,
         COALESCE(SUM(advance_deduction), 0)::numeric AS total_advances,
         COALESCE(SUM(loan_deduction), 0)::numeric AS total_loans,
         COALESCE(SUM(paye), 0)::numeric AS total_paye,
         COALESCE(SUM(nssf), 0)::numeric AS total_nssf,
         COALESCE(SUM(net_pay), 0)::numeric AS total_net
       FROM payroll_entries WHERE run_id = $1`,
      [runId],
    );
    const t = totals?.[0] || {};
    const totalGross = Number(t.total_gross || 0);
    const totalAdvances = Number(t.total_advances || 0);
    const totalLoans = Number(t.total_loans || 0);
    const totalPaye = Number(t.total_paye || 0);
    const totalNssf = Number(t.total_nssf || 0);
    const totalNet = Number(t.total_net || 0);
    const totalDeductions = totalAdvances + totalLoans + totalPaye + totalNssf;

    if (totalGross <= 0) {
      return Response.json({ error: "Run has no payroll entries with salary" }, { status: 400 });
    }

    const [acct5160, acct2300, acct1400, acct1410, acct2310, acct2320] = await Promise.all([
      getAccountIdByCode("5160"),
      getAccountIdByCode("2300"),
      getAccountIdByCode("1400"),
      getAccountIdByCode("1410"),
      getAccountIdByCode("2310"),
      getAccountIdByCode("2320"),
    ]);

    if (!acct5160 || !acct2300) {
      return Response.json({ error: "Required GL accounts (5160, 2300) not configured" }, { status: 500 });
    }

    const ref = `PAY-${run.year}-${String(run.month).padStart(2, "0")}`;
    const txDate = new Date().toISOString().slice(0, 10);

    // One transaction per non-zero credit line, all debiting 5160
    const creditLines = [
      { accountId: acct2300, amount: totalNet, label: "net salaries" },
      { accountId: acct1400, amount: totalAdvances, label: "advance recovery" },
      { accountId: acct1410, amount: totalLoans, label: "loan recovery" },
      { accountId: acct2310, amount: totalPaye, label: "PAYE" },
      { accountId: acct2320, amount: totalNssf, label: "NSSF" },
    ].filter((l) => l.accountId && l.amount > 0);

    if (creditLines.length === 0) {
      return Response.json({ error: "No valid credit lines to post" }, { status: 400 });
    }

    let firstTxnId = null;
    for (const line of creditLines) {
      const txnRows = await sql(
        `INSERT INTO transactions (
           transaction_date, description, reference_number,
           debit_account_id, credit_account_id,
           amount, currency, created_by,
           source_type, source_id, approval_status
         ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'payroll_run', $8, 'approved')
         RETURNING id`,
        [
          txDate,
          `Payroll ${String(run.month).padStart(2, "0")}/${run.year} — ${line.label}`,
          ref,
          acct5160,
          line.accountId,
          line.amount,
          perm.staff.id,
          runId,
        ],
      );
      if (!firstTxnId) firstTxnId = Number(txnRows[0].id);
    }

    await sql(
      `UPDATE payroll_runs
       SET status = 'approved', approved_by = $1, approved_at = NOW(),
           total_gross = $2, total_deductions = $3, total_net = $4,
           accrual_transaction_id = $5
       WHERE id = $6`,
      [perm.staff.id, totalGross, totalDeductions, totalNet, firstTxnId, runId],
    );

    return Response.json({ success: true, run_id: runId });
  } catch (error) {
    console.error("PUT /api/payroll/runs/[id]/approve error", error);
    return Response.json({ error: "Failed to approve run" }, { status: 500 });
  }
}
