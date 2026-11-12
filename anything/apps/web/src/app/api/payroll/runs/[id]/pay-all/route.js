import sql from "@/app/api/utils/sql";
import { requirePayrollManage } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";
import {
  payPayrollEntries,
  notPayableRunMessage,
  RUN_ALREADY_PAID_MSG,
} from "@/app/api/utils/payroll/payEntries";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function PUT(request, { params }) {
  const perm = await requirePayrollManage(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const runId = toNumber(params?.id);
    if (!runId) return Response.json({ error: "Invalid run id" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const paymentAccountId = toNumber(body?.payment_account_id);
    const paymentDate = parseDate(body?.payment_date) || new Date().toISOString().slice(0, 10);

    if (!paymentAccountId) {
      return Response.json({ error: "payment_account_id is required" }, { status: 400 });
    }

    const runRows = await sql(
      `SELECT id, month, year, status FROM payroll_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    if (!runRows?.length) return Response.json({ error: "Run not found" }, { status: 404 });
    if (runRows[0].status !== "approved") {
      return Response.json(
        { error: notPayableRunMessage(runRows[0].status) },
        { status: 409 },
      );
    }

    // Non-authoritative pre-check: lets us return early and only require the
    // 2300 account when there is something to pay. The locked write below is
    // what decides which entries get paid.
    const entryRows = await sql(
      `SELECT pe.id, pe.net_pay, pe.paid_at
       FROM payroll_entries pe
       WHERE pe.run_id = $1`,
      [runId],
    );
    const unpaidEntries = entryRows.filter((e) => !e.paid_at);

    if (entryRows.length === 0) {
      return Response.json({ success: true, paid_count: 0 });
    }
    if (unpaidEntries.length === 0) {
      // Approved run whose entries are all paid already.
      return Response.json({ error: RUN_ALREADY_PAID_MSG }, { status: 409 });
    }

    const acct2300 = await getAccountIdByCode("2300");
    if (!acct2300 && unpaidEntries.some((e) => Number(e.net_pay) > 0)) {
      return Response.json({ error: "Salaries Payable account (2300) not configured" }, { status: 500 });
    }

    // Atomic: lock on the run, claim only entries still unpaid at write time,
    // and post GL / recoveries for exactly those rows.
    const { runStatus, claimed } = await payPayrollEntries({
      runId,
      employeeId: null,
      paymentAccountId,
      paymentDate,
      staffId: perm.staff.id,
      acct2300,
    });

    if (claimed.length === 0) {
      // A concurrent request paid everything (or the run changed) while we
      // waited for the lock. 'approved' here means every entry is now paid.
      return Response.json(
        {
          error: runStatus === "approved"
            ? RUN_ALREADY_PAID_MSG
            : notPayableRunMessage(runStatus),
        },
        { status: 409 },
      );
    }

    const paidCount = claimed.length;
    return Response.json({ success: true, paid_count: paidCount });
  } catch (error) {
    console.error("PUT /api/payroll/runs/[id]/pay-all error", error);
    return Response.json({ error: "Failed to process bulk payment" }, { status: 500 });
  }
}
