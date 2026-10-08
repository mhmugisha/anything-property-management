import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountById, getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 5160 spend for the month, minus this run's own postings. Same filters as
// getExpenseCommitted; payroll posts several rows per run, so the run is
// excluded by source_type/source_id rather than a single transaction id.
// Params: $1 account id, $2 any date in the month, $3 run id.
const COMMITTED_EXCLUDING_RUN_SQL = `
  SELECT COALESCE(SUM(amount), 0)::numeric
  FROM transactions
  WHERE debit_account_id = $1::int
    AND COALESCE(is_deleted, false) = false
    AND COALESCE(approval_status, 'approved') IN ('approved', 'pending')
    AND date_trunc('month', transaction_date) = date_trunc('month', $2::date)
    AND (source_type IS DISTINCT FROM 'payroll_run' OR source_id IS DISTINCT FROM $3::int)
`;

// Locks the run so concurrent approvals serialise; the statements after it
// in the same transaction then see the winner's status and do nothing.
const LOCK_RUN_SQL = `SELECT status FROM payroll_runs WHERE id = $1 FOR UPDATE`;

// Raises the 5160 budget line to exactly cover committed + this run, and
// writes the audit row, in one statement. Recomputed here rather than taken
// from the client. Never lowers the line; no-op unless the run is still draft.
// Params: $1 account id, $2 posting date, $3 run id, $4 run total,
//         $5 staff id, $6 ip address.
const RAISE_BUDGET_SQL = `
  WITH run AS (
    SELECT id FROM payroll_runs WHERE id = $3::int AND status = 'draft'
  ),
  target AS (
    SELECT b.id,
           b.amount AS from_amount,
           CEIL((${COMMITTED_EXCLUDING_RUN_SQL}) + $4::numeric)::bigint AS to_amount
    FROM operating_budget_lines b
    WHERE b.account_id = $1::int
      AND b.period_month = date_trunc('month', $2::date)::date
      AND EXISTS (SELECT 1 FROM run)
  ),
  upd AS (
    UPDATE operating_budget_lines b
    SET amount = target.to_amount, updated_by = $5::int, updated_at = now()
    FROM target
    WHERE b.id = target.id AND target.to_amount > target.from_amount
    RETURNING b.id
  ),
  aud AS (
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
    SELECT $5::int, 'budget.payroll_raise', 'operating_budget_line', target.id,
           NULL,
           jsonb_build_object(
             'account_id', $1::int,
             'month', to_char(date_trunc('month', $2::date), 'YYYY-MM-DD'),
             'from', target.from_amount,
             'to', target.to_amount,
             'run_id', $3::int,
             'by', $5::int
           ),
           $6
    FROM target JOIN upd ON upd.id = target.id
    RETURNING id
  )
  SELECT target.from_amount, target.to_amount, EXISTS (SELECT 1 FROM upd) AS raised
  FROM target
`;

// Posts the run's 5160 debits (one row per non-zero credit line, same rows
// as before) and marks the run approved, in one statement.
// Params: $1 run id, $2 posting date, $3 reference, $4 5160 id, $5 staff id,
//         $6 descriptions[], $7 credit account ids[], $8 amounts[],
//         $9 total gross, $10 total deductions, $11 total net.
const POST_RUN_SQL = `
  WITH run AS (
    SELECT id FROM payroll_runs WHERE id = $1::int AND status = 'draft'
  ),
  ins AS (
    INSERT INTO transactions (
      transaction_date, description, reference_number,
      debit_account_id, credit_account_id,
      amount, currency, created_by,
      source_type, source_id, approval_status
    )
    SELECT $2::date, l.description, $3, $4::int, l.credit_account_id,
           l.amount, 'UGX', $5::int, 'payroll_run', run.id, 'approved'
    FROM run,
         unnest($6::text[], $7::int[], $8::numeric[])
           WITH ORDINALITY AS l(description, credit_account_id, amount, ord)
    ORDER BY l.ord
    RETURNING id
  )
  UPDATE payroll_runs
  SET status = 'approved', approved_by = $5::int, approved_at = NOW(),
      total_gross = $9, total_deductions = $10, total_net = $11,
      accrual_transaction_id = (SELECT MIN(id) FROM ins)
  WHERE id = $1::int AND status = 'draft'
  RETURNING id
`;

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
    const raiseBudget = body?.raise_budget === true;

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

    // Operating budget: payroll is never blocked. If this run would push 5160
    // over its budget line for the posting month, ask an Admin to raise the
    // line to exactly cover it. Unbudgeted months are unenforced.
    const runTotal = creditLines.reduce((sum, l) => sum + l.amount, 0);
    const budgetRows = await sql(
      `SELECT amount, to_char(period_month, 'YYYY-MM-DD') AS month
       FROM operating_budget_lines
       WHERE account_id = $1 AND period_month = date_trunc('month', $2::date)::date
       LIMIT 1`,
      [acct5160, txDate],
    );
    const budgetLine = budgetRows?.[0] || null;

    let overBudget = false;
    if (budgetLine) {
      const budget = Number(budgetLine.amount || 0);
      const committedRows = await sql(`SELECT (${COMMITTED_EXCLUDING_RUN_SQL}) AS total`, [
        acct5160,
        txDate,
        runId,
      ]);
      const committed = Number(committedRows?.[0]?.total || 0);
      const projected = Math.ceil(committed + runTotal);
      overBudget = projected > budget;

      if (overBudget && !raiseBudget) {
        const account = await getAccountById(acct5160);
        return Response.json({
          needs_budget_raise: true,
          current_budget: budget,
          new_budget: projected,
          overage: projected - budget,
          month: budgetLine.month,
          account_name: account?.account_name || "Payroll",
        });
      }
    }

    // Admin-only is enforced at the top of this handler, which covers
    // raise_budget=true as well.
    const queries = [sql(LOCK_RUN_SQL, [runId])];
    if (overBudget) {
      queries.push(
        sql(RAISE_BUDGET_SQL, [
          acct5160,
          txDate,
          runId,
          runTotal,
          perm.staff.id,
          perm.ipAddress || null,
        ]),
      );
    }
    queries.push(
      sql(POST_RUN_SQL, [
        runId,
        txDate,
        ref,
        acct5160,
        perm.staff.id,
        creditLines.map(
          (l) => `Payroll ${String(run.month).padStart(2, "0")}/${run.year} — ${l.label}`,
        ),
        creditLines.map((l) => l.accountId),
        creditLines.map((l) => l.amount),
        totalGross,
        totalDeductions,
        totalNet,
      ]),
    );

    const results = await sql.transaction(queries);
    const approvedRows = results[results.length - 1];
    if (!approvedRows?.length) {
      return Response.json({ error: "Only draft runs can be approved" }, { status: 409 });
    }

    const raise = overBudget ? results[1]?.[0] || null : null;
    return Response.json({
      success: true,
      run_id: runId,
      ...(raise?.raised
        ? {
            budget_raised: {
              from: Number(raise.from_amount),
              to: Number(raise.to_amount),
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("PUT /api/payroll/runs/[id]/approve error", error);
    return Response.json({ error: "Failed to approve run" }, { status: 500 });
  }
}
