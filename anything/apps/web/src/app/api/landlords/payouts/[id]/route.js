import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getAssetAccountBalance,
  getAccountById,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function canCreditForUpdate({ oldTx, nextCreditAccountId, nextAmount }) {
  const nextId = toNumber(nextCreditAccountId);
  const nextAmt = toNumber(nextAmount);
  if (!nextId || !nextAmt) return { ok: true };

  const acct = await getAccountById(nextId);
  if (!acct)
    return { ok: false, status: 400, body: { error: "Invalid account" } };
  if ((acct.account_type || "").trim() !== "Asset") return { ok: true };

  const oldCreditId = toNumber(oldTx?.credit_account_id);
  const oldAmt = Number(oldTx?.amount || 0);
  if (oldCreditId && oldCreditId === nextId) {
    const delta = nextAmt - oldAmt;
    if (delta <= 0) return { ok: true };
    return ensureCanCreditAccount({ creditAccountId: nextId, amount: delta });
  }

  const available = await getAssetAccountBalance(nextId);
  if (nextAmt > available) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Insufficient funds",
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
    const payoutId = toNumber(id);
    if (!payoutId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const rows = await sql`
      SELECT *
      FROM landlord_payouts
      WHERE id = ${payoutId}
        AND COALESCE(is_deleted,false) = false
      LIMIT 1
    `;
    const payout = rows?.[0] || null;
    if (!payout) return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({ payout });
  } catch (error) {
    console.error("GET /api/landlords/payouts/[id] error", error);
    return Response.json({ error: "Failed to fetch payout" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const payoutId = toNumber(id);
    if (!payoutId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldRows = await sql`
      SELECT *
      FROM landlord_payouts
      WHERE id = ${payoutId}
        AND COALESCE(is_deleted,false) = false
      LIMIT 1
    `;
    const oldPayout = oldRows?.[0] || null;
    if (!oldPayout)
      return Response.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    const payoutDate = (body?.payout_date || "").trim();
    const amount = toNumber(body?.amount);
    const method = (body?.payment_method || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;
    const notes = (body?.notes || "").trim() || null;

    if (!payoutDate || !amount || !method) {
      return Response.json(
        { error: "payout_date, amount, and payment_method are required" },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    const rentPayableRes = await resolveAccountIntent("landlord_liability");
    const cashRes = await resolveAccountIntent("cash_account");
    const bankRes = await resolveAccountIntent("bank_account");

    const rentPayableId = rentPayableRes.ok
      ? Number(rentPayableRes.accountId)
      : null;
    const cashId = cashRes.ok ? Number(cashRes.accountId) : null;
    const bankId = bankRes.ok ? Number(bankRes.accountId) : null;

    // FIX: Detect cash vs bank based on method containing "cash" (case-insensitive)
    // This handles both "Cash" and "Cash on Hand"
    const isCash = method.toLowerCase().includes("cash");
    const creditAccountId = isCash ? cashId : bankId;

    if (!rentPayableId || !creditAccountId) {
      return Response.json(
        { error: "Accounting accounts not set up correctly" },
        { status: 500 },
      );
    }

    // NEW: Prevent overpaying landlords when editing a payout.
    // Compute due excluding this payout row (so we can safely compare the updated amount).
    const dueExcludingThis = await getDueToLandlordsBalance({
      landlordId: oldPayout.landlord_id,
      propertyId: oldPayout.property_id,
      excludePayoutId: payoutId,
    });
    if (amount > Number(dueExcludingThis || 0)) {
      return Response.json(
        {
          error: `Overpayment blocked. Due to landlords for this property is ${Number(dueExcludingThis || 0)} UGX.`,
        },
        { status: 400 },
      );
    }

    const oldTxRows = await sql`
      SELECT *
      FROM transactions
      WHERE source_type = 'landlord_payout'
        AND source_id = ${payoutId}
        AND COALESCE(is_deleted,false) = false
      ORDER BY id DESC
      LIMIT 1
    `;

    const oldTx = oldTxRows?.[0] || null;

    // Check if the selected account has sufficient funds.
    // This checks account 1110 (Cash on Hand) if isCash=true, or 1120 (Bank) otherwise.
    if (oldTx) {
      const guard = await canCreditForUpdate({
        oldTx,
        nextCreditAccountId: creditAccountId,
        nextAmount: amount,
      });
      if (!guard.ok) return Response.json(guard.body, { status: guard.status });
    } else {
      const guard = await ensureCanCreditAccount({ creditAccountId, amount });
      if (!guard.ok) return Response.json(guard.body, { status: guard.status });
    }

    // Get landlord name for the transaction description
    const landlordRows = await sql`
      SELECT full_name FROM landlords WHERE id = ${oldPayout.landlord_id} LIMIT 1
    `;
    const landlordName = landlordRows?.[0]?.full_name || "Unknown Landlord";

    // Update the payout record
    const updatedPayoutRows = await sql`
      UPDATE landlord_payouts
      SET payout_date = ${payoutDate}::date,
          amount = ${amount},
          payment_method = ${method},
          reference_number = ${referenceNumber},
          notes = ${notes}
      WHERE id = ${payoutId}
      RETURNING *
    `;

    const updatedPayout = updatedPayoutRows?.[0] || null;

    const desc = `Landlord payout - ${landlordName}`;

    // Update or insert the corresponding transaction
    if (oldTx) {
      await sql`
        UPDATE transactions
        SET transaction_date = ${payoutDate}::date,
            description = ${desc},
            reference_number = ${referenceNumber},
            debit_account_id = ${rentPayableId},
            credit_account_id = ${creditAccountId},
            amount = ${amount}
        WHERE id = ${oldTx.id}
      `;
    } else {
      await sql`
        INSERT INTO transactions (
          transaction_date, description, reference_number,
          debit_account_id, credit_account_id,
          amount, currency, created_by,
          landlord_id, property_id,
          source_type, source_id
        )
        VALUES (
          ${payoutDate}::date, ${desc}, ${referenceNumber},
          ${rentPayableId}, ${creditAccountId},
          ${amount}, 'UGX', ${perm.staff.id},
          ${updatedPayout.landlord_id}, ${updatedPayout.property_id},
          'landlord_payout', ${payoutId}
        )
      `;
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.payout.update",
      entityType: "landlord_payout",
      entityId: payoutId,
      oldValues: oldPayout,
      newValues: updatedPayout,
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      payout: updatedPayout,
      message: "Payment updated.",
    });
  } catch (error) {
    console.error("PUT /api/landlords/payouts/[id] error", error);
    return Response.json(
      { error: error?.message || "Failed to update payout" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const payoutId = toNumber(id);
    if (!payoutId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldRows = await sql`
      SELECT *
      FROM landlord_payouts
      WHERE id = ${payoutId}
        AND COALESCE(is_deleted,false) = false
      LIMIT 1
    `;
    const oldPayout = oldRows?.[0] || null;
    if (!oldPayout)
      return Response.json({ error: "Not found" }, { status: 404 });

    await sql.transaction(async (txn) => {
      await txn`
        UPDATE landlord_payouts
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = ${perm.staff.id}
        WHERE id = ${payoutId}
      `;

      await txn`
        UPDATE transactions
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = ${perm.staff.id}
        WHERE source_type = 'landlord_payout'
          AND source_id = ${payoutId}
          AND COALESCE(is_deleted,false) = false
      `;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.payout.delete",
      entityType: "landlord_payout",
      entityId: payoutId,
      oldValues: oldPayout,
      newValues: { ...oldPayout, is_deleted: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      message: "Payment deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/landlords/payouts/[id] error", error);
    return Response.json({ error: "Failed to delete payout" }, { status: 500 });
  }
}
