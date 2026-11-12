import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/staff";
import { PAYROLL_RUN_LOCK_NAMESPACE } from "@/app/api/utils/payroll/payEntries";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const NOT_APPROVED_MSG = "Only approved runs can be returned to draft.";
const SOME_PAID_MSG = "Can't return to draft: some employees have already been paid.";

// Undoes exactly what /approve does:
//   * the run's accrual GL rows (source_type 'payroll_run', source_id = run id:
//     Dr 5160 / Cr 2300 net, 1400 advances, 1410 loans, 2310 PAYE, 2320 NSSF)
//     are soft-deleted (same is_deleted/deleted_at/deleted_by convention as
//     allocationCleanup.js);
//   * status 'approved' -> 'draft', approved_by / approved_at /
//     accrual_transaction_id cleared.
// Approval reserves nothing on advances/loans (recoveries happen at payment),
// so there is nothing else to undo. Totals are left as they are: they are the
// entry sums, which a draft run carries too.
//
// Runs as the 2nd statement of the batch, after pg_advisory_xact_lock on the
// run (the same lock Pay / Pay All take), so it sees any payout committed
// before it and no payout can start until it commits.
// Params: $1 run id, $2 staff id, $3 ip address.
const RETURN_TO_DRAFT_SQL = `
  WITH run AS (
    SELECT id, status, approved_by, approved_at, accrual_transaction_id
    FROM payroll_runs
    WHERE id = $1::int
    FOR UPDATE
  ),
  paid AS (
    SELECT COUNT(*)::int AS n
    FROM payroll_entries
    WHERE run_id = $1::int AND paid_at IS NOT NULL
  ),
  ok AS (
    SELECT r.* FROM run r, paid p
    WHERE r.status = 'approved' AND p.n = 0
  ),
  gl AS (
    UPDATE transactions t
    SET is_deleted = true,
        deleted_at = now(),
        deleted_by = $2::int
    FROM ok
    WHERE t.source_type = 'payroll_run'
      AND t.source_id = ok.id
      AND COALESCE(t.is_deleted, false) = false
    RETURNING t.id, t.amount, t.debit_account_id, t.credit_account_id
  ),
  upd AS (
    UPDATE payroll_runs pr
    SET status = 'draft',
        approved_by = NULL,
        approved_at = NULL,
        accrual_transaction_id = NULL
    FROM ok
    WHERE pr.id = ok.id AND pr.status = 'approved'
    RETURNING pr.id
  ),
  aud AS (
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
    SELECT $2::int, 'payroll.run.return_to_draft', 'payroll_run', upd.id,
           jsonb_build_object(
             'status', ok.status,
             'approved_by', ok.approved_by,
             'approved_at', ok.approved_at,
             'accrual_transaction_id', ok.accrual_transaction_id
           ),
           jsonb_build_object(
             'status', 'draft',
             'gl_soft_deleted', COALESCE(
               (SELECT jsonb_agg(jsonb_build_object(
                  'id', gl.id, 'amount', gl.amount,
                  'debit_account_id', gl.debit_account_id,
                  'credit_account_id', gl.credit_account_id
                ) ORDER BY gl.id) FROM gl),
               '[]'::jsonb
             )
           ),
           $3
    FROM upd JOIN ok ON ok.id = upd.id
    RETURNING id
  )
  SELECT
    (SELECT status FROM run)            AS run_status,
    (SELECT n FROM paid)                AS paid_count,
    (SELECT COUNT(*) FROM upd)::int     AS returned,
    (SELECT COUNT(*) FROM gl)::int      AS gl_reversed,
    (SELECT COUNT(*) FROM aud)::int     AS audited
`;

export async function POST(request, { params }) {
  // Admin only — payroll_manage (Accountant) cannot return a run to draft.
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const runId = toNumber(params?.id);
    if (!runId) return Response.json({ error: "Invalid run id" }, { status: 400 });

    const runRows = await sql(`SELECT id FROM payroll_runs WHERE id = $1 LIMIT 1`, [runId]);
    if (!runRows?.length) return Response.json({ error: "Run not found" }, { status: 404 });

    const [, rows] = await sql.transaction([
      sql(`SELECT pg_advisory_xact_lock($1, $2)`, [PAYROLL_RUN_LOCK_NAMESPACE, runId]),
      sql(RETURN_TO_DRAFT_SQL, [runId, perm.staff.id, perm.ipAddress || null]),
    ]);

    const row = rows?.[0] || {};
    if (Number(row.returned || 0) === 0) {
      if (row.run_status === null || row.run_status === undefined) {
        return Response.json({ error: "Run not found" }, { status: 404 });
      }
      // Paid entries win: a 'paid' run gets the "already been paid" message.
      const error = Number(row.paid_count || 0) > 0 ? SOME_PAID_MSG : NOT_APPROVED_MSG;
      return Response.json({ error }, { status: 409 });
    }

    return Response.json({
      success: true,
      run_id: runId,
      gl_reversed: Number(row.gl_reversed || 0),
    });
  } catch (error) {
    console.error("POST /api/payroll/runs/[id]/return-to-draft error", error);
    return Response.json({ error: "Failed to return run to draft" }, { status: 500 });
  }
}
