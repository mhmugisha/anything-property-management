import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getAssetAccountBalance,
  getAccountById,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function getTx(id) {
  const txId = toNumber(id);
  if (!txId) return null;
  const rows = await sql`
    SELECT *
    FROM transactions
    WHERE id = ${txId}
    LIMIT 1
  `;
  return rows?.[0] || null;
}

async function getActiveAccount(id) {
  const acct = await getAccountById(id);
  if (!acct)
    return { ok: false, status: 400, body: { error: "Invalid account" } };
  if (acct.is_active === false) {
    return {
      ok: false,
      status: 400,
      body: { error: "One of the selected accounts is inactive" },
    };
  }
  return { ok: true, account: acct };
}

async function ensureCanCreditForUpdate({
  oldTx,
  newCreditAccountId,
  newAmount,
}) {
  const nextCreditId = toNumber(newCreditAccountId);
  const nextAmt = toNumber(newAmount);
  if (!nextCreditId || !nextAmt) return { ok: true };

  const acct = await getAccountById(nextCreditId);
  if (!acct)
    return { ok: false, status: 400, body: { error: "Invalid account" } };

  if ((acct.account_type || "").trim() !== "Asset") {
    return { ok: true };
  }

  // For updates, the existing tx is already included in balances.
  // If the credit account stays the same, we only need to check the *increase*.
  const oldCreditId = toNumber(oldTx?.credit_account_id);
  const oldAmt = Number(oldTx?.amount || 0);

  if (oldCreditId && oldCreditId === nextCreditId) {
    const delta = nextAmt - oldAmt;
    if (delta <= 0) return { ok: true };
    return ensureCanCreditAccount({
      creditAccountId: nextCreditId,
      amount: delta,
    });
  }

  // If switching credit accounts, check full amount on the new account.
  // This is safe because the old tx wasn't reducing the new account.
  const available = await getAssetAccountBalance(nextCreditId);
  if (nextAmt > available) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Insufficient funds:",
        available,
      },
    };
  }

  return { ok: true };
}

export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tx = await getTx(id);
    if (!tx || tx.is_deleted === true) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ transaction: tx });
  } catch (error) {
    console.error("GET /api/accounting/transactions/[id] error", error);
    return Response.json(
      { error: "Failed to fetch transaction" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const txId = toNumber(id);
    if (!txId) return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldTx = await getTx(txId);
    if (!oldTx || oldTx.is_deleted === true) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // For safety: only allow editing manual entries.
    // System-generated rows (payments, payouts, deductions) should be edited from their own flows.
    if (oldTx.source_type && oldTx.source_type !== "manual") {
      return Response.json(
        {
          error:
            "This entry is system-generated. Edit it from the original record (payment/payout/deduction).",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const transactionDate = (body?.transaction_date || "").trim();
    const description = (body?.description || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;

    const debitAccountId = toNumber(body?.debit_account_id);
    const creditAccountId = toNumber(body?.credit_account_id);
    const amount = toNumber(body?.amount);
    const currency = (body?.currency || oldTx.currency || "UGX").trim();

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

    const debitOk = await getActiveAccount(debitAccountId);
    if (!debitOk.ok)
      return Response.json(debitOk.body, { status: debitOk.status });

    const creditOk = await getActiveAccount(creditAccountId);
    if (!creditOk.ok)
      return Response.json(creditOk.body, { status: creditOk.status });

    // NEW: prevent overpaying landlords via manual transaction edits.
    // We only enforce this when the updated transaction reduces account 2100 by crediting an Asset account.
    const rentPayableRows = await sql(
      "SELECT id FROM chart_of_accounts WHERE account_code = $1 LIMIT 1",
      ["2100"],
    );
    const rentPayableId = rentPayableRows?.[0]?.id
      ? Number(rentPayableRows[0].id)
      : null;

    if (
      rentPayableId &&
      (creditOk.account?.account_type || "").trim() === "Asset"
    ) {
      const newEffect =
        (Number(creditAccountId) === rentPayableId ? Number(amount) : 0) -
        (Number(debitAccountId) === rentPayableId ? Number(amount) : 0);

      const oldEffect =
        (Number(oldTx.credit_account_id) === rentPayableId
          ? Number(oldTx.amount || 0)
          : 0) -
        (Number(oldTx.debit_account_id) === rentPayableId
          ? Number(oldTx.amount || 0)
          : 0);

      // Only enforce when the updated entry *reduces* due (i.e. debits 2100).
      const reducesDueNow = Number(debitAccountId) === rentPayableId;
      if (reducesDueNow) {
        const dueCurrent = await getDueToLandlordsBalance();
        const dueExcludingThis = Number(dueCurrent || 0) - oldEffect;

        // If newEffect is a reduction, its magnitude is amount (since debit=2100).
        const reductionAmt = Math.abs(newEffect);

        if (reductionAmt > Number(dueExcludingThis || 0)) {
          return Response.json(
            {
              error: `Overpayment blocked. Due to landlords is ${Number(dueExcludingThis || 0)} UGX.`,
            },
            { status: 400 },
          );
        }
      }
    }

    const guard = await ensureCanCreditForUpdate({
      oldTx,
      newCreditAccountId: creditAccountId,
      newAmount: amount,
    });

    if (!guard.ok) {
      return Response.json(guard.body, { status: guard.status });
    }

    const rows = await sql`
      UPDATE transactions
      SET
        transaction_date = ${transactionDate}::date,
        description = ${description},
        reference_number = ${referenceNumber},
        debit_account_id = ${debitAccountId},
        credit_account_id = ${creditAccountId},
        amount = ${amount},
        currency = ${currency},
        -- If it was created before we introduced source_type, treat it as manual.
        source_type = COALESCE(source_type, 'manual'),
        source_id = COALESCE(source_id, id)
      WHERE id = ${txId}
      RETURNING *
    `;

    const updated = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transaction.update",
      entityType: "transaction",
      entityId: txId,
      oldValues: oldTx,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ transaction: updated });
  } catch (error) {
    console.error("PUT /api/accounting/transactions/[id] error", error);
    return Response.json(
      { error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const txId = toNumber(id);
    if (!txId) return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldTx = await getTx(txId);
    if (!oldTx || oldTx.is_deleted === true) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Same safety rule: don't allow deleting system-generated transactions here.
    if (oldTx.source_type && oldTx.source_type !== "manual") {
      return Response.json(
        {
          error:
            "This entry is system-generated. Delete it from the original record (payment/payout/deduction).",
        },
        { status: 400 },
      );
    }

    const rows = await sql`
      UPDATE transactions
      SET is_deleted = true,
          deleted_at = now(),
          deleted_by = ${perm.staff.id},
          source_type = COALESCE(source_type, 'manual'),
          source_id = COALESCE(source_id, id)
      WHERE id = ${txId}
      RETURNING *
    `;

    const deleted = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transaction.delete",
      entityType: "transaction",
      entityId: txId,
      oldValues: oldTx,
      newValues: deleted,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/accounting/transactions/[id] error", error);
    return Response.json(
      { error: "Failed to delete transaction" },
      { status: 500 },
    );
  }
}
