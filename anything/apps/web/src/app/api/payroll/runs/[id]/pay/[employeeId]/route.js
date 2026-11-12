import sql from "@/app/api/utils/sql";
import { requirePayrollManage } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";
import {
  payPayrollEntries,
  notPayableRunMessage,
  EMPLOYEE_ALREADY_PAID_MSG,
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
    const employeeId = toNumber(params?.employeeId);
    if (!runId || !employeeId) {
      return Response.json({ error: "Invalid run or employee id" }, { status: 400 });
    }

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

    const entryRows = await sql(
      `SELECT id, net_pay, paid_at
       FROM payroll_entries WHERE run_id = $1 AND employee_id = $2 LIMIT 1`,
      [runId, employeeId],
    );
    if (!entryRows?.length) {
      return Response.json({ error: "Entry not found for this employee in this run" }, { status: 404 });
    }
    const entry = entryRows[0];
    if (entry.paid_at) {
      return Response.json({ error: EMPLOYEE_ALREADY_PAID_MSG }, { status: 409 });
    }

    const acct2300 = await getAccountIdByCode("2300");
    if (!acct2300 && Number(entry.net_pay) > 0) {
      return Response.json({ error: "Salaries Payable account (2300) not configured" }, { status: 500 });
    }

    // Atomic: lock on the run and claim this employee's entry only if it is
    // still unpaid at write time. GL (Dr 2300 / Cr payment account), advance
    // and loan recovery, and run -> 'paid' happen only for a claimed entry.
    const { runStatus, claimed } = await payPayrollEntries({
      runId,
      employeeId,
      paymentAccountId,
      paymentDate,
      staffId: perm.staff.id,
      acct2300,
    });

    if (claimed.length === 0) {
      // A concurrent request paid this employee (or the run changed) while we
      // waited for the lock. Still 'approved' = just this employee was paid.
      return Response.json(
        {
          error: runStatus === "approved"
            ? EMPLOYEE_ALREADY_PAID_MSG
            : notPayableRunMessage(runStatus),
        },
        { status: 409 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("PUT /api/payroll/runs/[id]/pay/[employeeId] error", error);
    return Response.json({ error: "Failed to process payment" }, { status: 500 });
  }
}
