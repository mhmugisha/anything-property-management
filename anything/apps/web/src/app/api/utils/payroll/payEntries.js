import sql from "@/app/api/utils/sql";

// Namespace for pg_advisory_xact_lock(ns, run_id). Every payout of a payroll
// run (Pay All, or Pay for one employee) serialises on its run, so two clicks
// can never both see an entry as unpaid. (41130 = unit lock, see
// materializeTenantWithLease.js; 41132 = tenant credit lock, see autoApply.js.)
export const PAYROLL_RUN_LOCK_NAMESPACE = 41131;

// 409 messages shared by pay-all and pay/[employeeId], chosen by run status.
export const RUN_ALREADY_PAID_MSG = "This payroll run has already been paid.";
export const EMPLOYEE_ALREADY_PAID_MSG = "This employee has already been paid for this run.";
export const RUN_NOT_APPROVED_MSG = "Run must be approved before paying";

/** 409 message for a run that is not payable: 'paid' vs draft/other. */
export function notPayableRunMessage(status) {
  return status === "paid" ? RUN_ALREADY_PAID_MSG : RUN_NOT_APPROVED_MSG;
}

/**
 * Pays the still-unpaid entries of an approved payroll run, atomically.
 *
 * One sql.transaction batch:
 *   1. pg_advisory_xact_lock on the run id;
 *   2. a single chained-CTE statement whose snapshot is taken AFTER the lock.
 *      It claims entries with UPDATE ... WHERE paid_at IS NULL RETURNING, and
 *      every side effect (GL Dr 2300 / Cr payment account, advance recovery,
 *      loan instalment, run -> 'paid') is driven only by the rows claimed in
 *      that same statement. A second concurrent call claims zero rows and so
 *      writes nothing.
 *
 * @param {object} p
 * @param {number} p.runId
 * @param {number|null} p.employeeId   null = all unpaid entries of the run
 * @param {number} p.paymentAccountId
 * @param {string} p.paymentDate       YYYY-MM-DD
 * @param {number} p.staffId
 * @param {number|null} p.acct2300     Salaries Payable account id
 * @returns {Promise<{ runStatus: string|null, claimed: Array<object> }>}
 *   runStatus = run status seen under the lock (null if the run is gone);
 *   claimed   = entries actually paid by this call.
 */
export async function payPayrollEntries({
  runId,
  employeeId = null,
  paymentAccountId,
  paymentDate,
  staffId,
  acct2300,
}) {
  const query = `
    WITH run AS (
      SELECT id, month, year, status
      FROM payroll_runs
      WHERE id = $1
      FOR UPDATE
    ),
    claimed AS (
      UPDATE payroll_entries pe
      -- $3::date everywhere (date -> timestamptz is midnight in the session
      -- time zone, same as the old '$1::timestamptz' on a YYYY-MM-DD string).
      -- One cast per parameter keeps Postgres' parameter type inference
      -- consistent.
      SET paid_at = $3::date,
          payment_account_id = $4::int
      FROM run r
      WHERE pe.run_id = r.id
        AND r.status = 'approved'
        AND pe.paid_at IS NULL
        AND ($2::int IS NULL OR pe.employee_id = $2::int)
      RETURNING pe.id, pe.employee_id, pe.net_pay,
                pe.advance_deduction, pe.loan_deduction
    ),
    gl AS (
      INSERT INTO transactions (
        transaction_date, description, reference_number,
        debit_account_id, credit_account_id,
        amount, currency, created_by,
        employee_id,
        source_type, source_id, approval_status
      )
      SELECT
        $3::date,
        'Salary payment — employee #' || c.employee_id,
        'PAY-' || r.year || '-' || lpad(r.month::text, 2, '0') || '-EMP' || c.employee_id,
        $5::int, $4::int,
        c.net_pay, 'UGX', $6::int,
        c.employee_id,
        'payroll_payment', c.id, 'approved'
      FROM claimed c CROSS JOIN run r
      WHERE c.net_pay > 0
      RETURNING id
    ),
    -- Advance deduction -> outstanding advances, oldest first (same walk as
    -- the old JS loop: each advance takes min(outstanding, what is left).)
    adv AS (
      SELECT
        a.id,
        GREATEST(a.amount - a.recovered_amount, 0) AS outstanding,
        c.advance_deduction AS deduction,
        COALESCE(SUM(GREATEST(a.amount - a.recovered_amount, 0)) OVER (
          PARTITION BY c.id
          ORDER BY a.advance_date ASC, a.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0) AS before
      FROM claimed c
      JOIN employee_advances a ON a.employee_id = c.employee_id
      WHERE c.advance_deduction > 0
        AND a.status != 'recovered'
        AND COALESCE(a.is_voided, false) = false
    ),
    adv_upd AS (
      UPDATE employee_advances ea
      SET recovered_amount = LEAST(ea.amount, ea.recovered_amount + x.apply),
          status = CASE
            WHEN ea.recovered_amount + x.apply >= ea.amount THEN 'recovered'
            ELSE 'partial'
          END
      FROM (
        SELECT id, LEAST(outstanding, deduction - before) AS apply
        FROM adv
        WHERE deduction - before > 0
      ) x
      WHERE ea.id = x.id
      RETURNING ea.id
    ),
    -- Loan deduction -> one instalment per active loan.
    loan_upd AS (
      UPDATE employee_loans el
      SET recovered_amount = el.recovered_amount + el.monthly_instalment,
          paid_instalments = el.paid_instalments + 1,
          status = CASE
            WHEN el.recovered_amount + el.monthly_instalment >= el.amount THEN 'completed'
            ELSE 'active'
          END
      FROM claimed c
      WHERE el.employee_id = c.employee_id
        AND c.loan_deduction > 0
        AND el.status = 'active'
      RETURNING el.id
    ),
    -- Run -> 'paid' once nothing is left unpaid (the statement snapshot still
    -- shows the claimed rows as unpaid, so exclude them explicitly).
    run_upd AS (
      UPDATE payroll_runs pr
      SET status = 'paid'
      FROM run r
      WHERE pr.id = r.id
        AND r.status = 'approved'
        AND EXISTS (SELECT 1 FROM claimed)
        AND NOT EXISTS (
          SELECT 1 FROM payroll_entries pe
          WHERE pe.run_id = r.id
            AND pe.paid_at IS NULL
            AND pe.id NOT IN (SELECT id FROM claimed)
        )
      RETURNING pr.id
    )
    SELECT
      (SELECT status FROM run) AS run_status,
      COALESCE(
        (SELECT json_agg(json_build_object(
           'id', c.id, 'employee_id', c.employee_id, 'net_pay', c.net_pay
         ) ORDER BY c.id) FROM claimed c),
        '[]'::json
      ) AS claimed,
      (SELECT COUNT(*) FROM gl)::int AS gl_posted,
      (SELECT COUNT(*) FROM adv_upd)::int AS advances_updated,
      (SELECT COUNT(*) FROM loan_upd)::int AS loans_updated,
      (SELECT COUNT(*) FROM run_upd)::int AS run_marked_paid
  `;

  const [, rows] = await sql.transaction([
    sql(`SELECT pg_advisory_xact_lock($1, $2)`, [
      PAYROLL_RUN_LOCK_NAMESPACE,
      Number(runId),
    ]),
    sql(query, [
      Number(runId),
      employeeId === null || employeeId === undefined ? null : Number(employeeId),
      paymentDate,
      Number(paymentAccountId),
      acct2300 === null || acct2300 === undefined ? null : Number(acct2300),
      staffId === null || staffId === undefined ? null : Number(staffId),
    ]),
  ]);

  const row = rows?.[0] || {};
  const claimed = Array.isArray(row.claimed)
    ? row.claimed
    : typeof row.claimed === "string"
      ? JSON.parse(row.claimed)
      : [];

  return { runStatus: row.run_status ?? null, claimed };
}
