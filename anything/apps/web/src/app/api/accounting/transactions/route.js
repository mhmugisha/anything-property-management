import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

async function getAccountIdByCode(code) {
  const rows = await sql(
    "SELECT id FROM chart_of_accounts WHERE account_code = $1 LIMIT 1",
    [String(code)],
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const where = ["COALESCE(t.is_deleted,false) = false"];
    const values = [];

    if (from) {
      where.push(`t.transaction_date >= $${values.length + 1}::date`);
      values.push(from);
    }

    if (to) {
      where.push(`t.transaction_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    // We want the *latest* items included, but displayed oldest -> newest
    // so the newest entry appears at the bottom.
    const query = `
      SELECT * FROM (
        SELECT t.*, 
          da.account_code AS debit_code, da.account_name AS debit_name,
          ca.account_code AS credit_code, ca.account_name AS credit_name,
          su.full_name AS created_by_name
        FROM transactions t
        LEFT JOIN chart_of_accounts da ON t.debit_account_id = da.id
        LEFT JOIN chart_of_accounts ca ON t.credit_account_id = ca.id
        LEFT JOIN staff_users su ON t.created_by = su.id
        ${whereSql}
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT 300
      ) recent
      ORDER BY recent.transaction_date ASC, recent.id ASC
    `;

    const transactions = await sql(query, values);
    return Response.json({ transactions });
  } catch (error) {
    console.error("GET /api/accounting/transactions error", error);
    return Response.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const transactionDate = (body?.transaction_date || "").trim();
    const description = (body?.description || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;

    const debitAccountId = toNumber(body?.debit_account_id);
    const creditAccountId = toNumber(body?.credit_account_id);
    const amount = toNumber(body?.amount);
    const currency = "UGX"; // Hardcoded to UGX only

    if (
      !transactionDate ||
      !description ||
      !debitAccountId ||
      !creditAccountId ||
      !amount
    ) {
      return Response.json(
        {
          error:
            "transaction_date, description, debit_account_id, credit_account_id, amount are required",
        },
        { status: 400 },
      );
    }

    if (debitAccountId === creditAccountId) {
      return Response.json(
        { error: "Debit and credit accounts must be different" },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    const accountRows = await sql`
      SELECT id, is_active, account_type
      FROM chart_of_accounts
      WHERE id IN (${debitAccountId}, ${creditAccountId})
    `;

    if (!accountRows || accountRows.length !== 2) {
      return Response.json(
        { error: "Invalid account selection" },
        { status: 400 },
      );
    }

    const inactive = accountRows.find((a) => a.is_active === false);
    if (inactive) {
      return Response.json(
        { error: "One of the selected accounts is inactive" },
        { status: 400 },
      );
    }

    // NEW: prevent overpaying landlords via manual journal entries.
    // If this manual entry reduces account 2100 (Due to Landlords) by crediting an Asset account,
    // only allow up to the current due balance.
    const rentPayableId = await getAccountIdByCode("2100");
    const creditAcct = accountRows.find(
      (a) => Number(a.id) === Number(creditAccountId),
    );
    const creditType = (creditAcct?.account_type || "").trim();
    const reducesDueToLandlords =
      rentPayableId &&
      Number(debitAccountId) === Number(rentPayableId) &&
      creditType === "Asset";

    if (reducesDueToLandlords) {
      const dueNow = await getDueToLandlordsBalance();
      if (Number(amount) > Number(dueNow || 0)) {
        return Response.json(
          {
            error: `Overpayment blocked. Due to landlords is ${Number(dueNow || 0)} UGX.`,
          },
          { status: 400 },
        );
      }
    }

    // NEW: Prevent crediting (reducing) an Asset account below zero.
    // This covers Cash/Bank and any future Asset accounts you create.
    const guard = await ensureCanCreditAccount({
      creditAccountId,
      amount,
    });
    if (!guard.ok) {
      return Response.json(guard.body, { status: guard.status });
    }

    const approval = getApprovalFields(perm.staff);
    const rows = await sql`
      INSERT INTO transactions (
        transaction_date, description, reference_number,
        debit_account_id, credit_account_id,
        amount, currency,
        created_by,
        source_type,
        approval_status, approved_by, approved_at
      )
      VALUES (
        ${transactionDate}::date, ${description}, ${referenceNumber},
        ${debitAccountId}, ${creditAccountId},
        ${amount}, ${currency},
        ${perm.staff.id},
        'manual',
        ${approval.approval_status}, ${approval.approved_by}, ${approval.approved_at}
      )
      RETURNING *
    `;

    const tx = rows?.[0] || null;

    // NEW: stamp source_id
    if (tx?.id) {
      await sql`
        UPDATE transactions
        SET source_id = ${tx.id}
        WHERE id = ${tx.id}
      `;
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transaction.create",
      entityType: "transaction",
      entityId: tx?.id || null,
      oldValues: null,
      newValues: tx,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about new transaction
    notifyAllAdminsAsync({
      title: "New Transaction Recorded",
      message: `New transaction recorded: ${description} - ${currency} ${Number(amount).toLocaleString()}. Recorded by ${perm.staff.full_name || "Staff"}`,
      type: "transaction",
      reference_id: tx?.id,
      reference_type: "transaction",
    });

    return Response.json({ transaction: tx });
  } catch (error) {
    console.error("POST /api/accounting/transactions error", error);
    return Response.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}
