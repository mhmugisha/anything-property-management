import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  getAccountIdByCode,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { SETTLED_EPSILON } from "@/app/api/utils/landlordCloseGate";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const MODES = {
  collect: {
    sourceType: "landlord_collection",
    action: "landlord.collect",
    describe: (who) => `Collection from landlord ${who}`,
  },
  writeoff: {
    sourceType: "landlord_writeoff",
    action: "landlord.writeoff",
    describe: (who) => `Write-off (bad debt) — ${who}`,
  },
};

// Settle what a landlord owes the agency on one property (negative net due),
// so the close gate can pass. Collect: Dr Cash/Bank / Cr 2100. Write off:
// Dr 5300 Bad Debt / Cr 2100. Either way a positive balance adjustment brings
// the property's due back toward zero.
export async function POST(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = toNumber(body?.property_id);
    const modeKey = String(body?.mode || "");
    const amount = toNumber(body?.amount);
    const accountId = toNumber(body?.account_id);
    const reasonInput = String(body?.reason || "").trim();

    // 1. Landlord and property.
    const [landlord] = await sql`
      SELECT id, full_name FROM landlords WHERE id = ${landlordId} LIMIT 1
    `;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }
    const [propRow] = propertyId
      ? await sql`SELECT landlord_id, property_name FROM properties WHERE id = ${propertyId} LIMIT 1`
      : [];
    if (!propRow || Number(propRow.landlord_id) !== landlordId) {
      return Response.json(
        { error: "Property does not belong to this landlord" },
        { status: 400 },
      );
    }

    // 2. This property's due, from the source tables.
    const due = Number(
      (await getDueToLandlordsBalance({ landlordId, propertyId })) || 0,
    );
    if (!(due < -SETTLED_EPSILON)) {
      return Response.json(
        { error: "This property does not owe the agency." },
        { status: 409 },
      );
    }
    const owed = -due;

    // 3. Amount: positive, whole UGX (adjustments are BIGINT), never above
    // what is owed.
    if (!amount || amount <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!Number.isInteger(amount)) {
      return Response.json(
        { error: "amount must be a whole number of UGX" },
        { status: 400 },
      );
    }
    if (amount > owed + SETTLED_EPSILON) {
      return Response.json(
        { error: "Amount is more than this property owes the agency." },
        { status: 400 },
      );
    }

    // 4. Mode.
    const mode = MODES[modeKey];
    if (!mode) {
      return Response.json(
        { error: 'mode must be "collect" or "writeoff"' },
        { status: 400 },
      );
    }

    // 5. Collect: into the system Cash or operating Bank account only, same
    // rule as the close's payout account. Write off: a reason is required.
    let debitAccountId = null;
    if (modeKey === "collect") {
      const [cashRes, bankRes] = await Promise.all([
        resolveAccountIntent("cash_account"),
        resolveAccountIntent("bank_account"),
      ]);
      const allowed =
        accountId &&
        ((cashRes.ok && Number(cashRes.accountId) === accountId) ||
          (bankRes.ok && Number(bankRes.accountId) === accountId));
      if (!allowed) {
        return Response.json(
          { error: "Choose Cash on Hand or the operating bank account" },
          { status: 400 },
        );
      }
      debitAccountId = accountId;
    } else if (!reasonInput) {
      return Response.json(
        { error: "A reason is required to write off" },
        { status: 400 },
      );
    }

    const [acct2100, acct5300] = await Promise.all([
      getAccountIdByCode("2100"),
      getAccountIdByCode("5300"),
    ]);
    if (!acct2100) {
      return Response.json(
        { error: "Account 2100 not configured" },
        { status: 500 },
      );
    }
    if (modeKey === "writeoff") {
      if (!acct5300) {
        return Response.json(
          { error: "Account 5300 not configured" },
          { status: 500 },
        );
      }
      debitAccountId = acct5300;
    }

    // Posting description, also the adjustment reason: names the landlord and
    // property so the journal is readable. The statement labels these rows by
    // source_type, so it is unaffected.
    const reason =
      mode.describe(`${landlord.full_name} (${propRow.property_name})`) +
      (reasonInput ? ` — ${reasonInput}` : "");
    const today = new Date().toISOString().slice(0, 10);

    // Duplicate-submit guard, same as recordLandlordPayout: an identical
    // settle recorded within the last 60 seconds is rejected.
    const dupeRows = await sql`
      SELECT id FROM landlord_balance_adjustments
      WHERE landlord_id = ${landlordId}
        AND property_id = ${propertyId}
        AND source_type = ${mode.sourceType}
        AND amount = ${amount}
        AND COALESCE(is_deleted, false) = false
        AND created_at >= NOW() - INTERVAL '60 seconds'
      LIMIT 1
    `;
    if (dupeRows?.length > 0) {
      return Response.json(
        {
          error:
            "Duplicate settlement detected — wait a moment and re-check the balance.",
        },
        { status: 409 },
      );
    }

    // One statement so the GL posting and the adjustment commit together.
    // The adjustment is positive: it raises the (negative) due toward zero.
    const [txnRow] = await sql`
      WITH txn AS (
        INSERT INTO transactions (
          transaction_date, description,
          debit_account_id, credit_account_id,
          amount, currency,
          created_by, landlord_id, property_id,
          reference_number, source_type
        ) VALUES (
          ${today}::date, ${reason},
          ${debitAccountId}, ${acct2100},
          ${amount}, 'UGX',
          ${perm.staff.id}, ${landlordId}, ${propertyId},
          ${null}, ${mode.sourceType}
        ) RETURNING id
      ),
      adj AS (
        INSERT INTO landlord_balance_adjustments (
          landlord_id, property_id, amount, reason,
          source_type, source_id, created_by, effective_date
        )
        SELECT ${landlordId}, ${propertyId}, ${amount}, ${reason},
               ${mode.sourceType}, txn.id, ${perm.staff.id}, ${today}::date
        FROM txn
        RETURNING id
      )
      SELECT txn.id, adj.id AS adjustment_id FROM txn, adj
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: mode.action,
      entityType: "transaction",
      entityId: toNumber(txnRow?.id),
      oldValues: { due_to_landlord: due },
      newValues: {
        adjustment_id: toNumber(txnRow?.adjustment_id),
        landlord_id: landlordId,
        property_id: propertyId,
        amount,
        account_id: debitAccountId,
        reason,
      },
      ipAddress: perm.ipAddress,
    });

    const newDue = Number(
      (await getDueToLandlordsBalance({ landlordId, propertyId })) || 0,
    );

    return Response.json({
      success: true,
      property_id: propertyId,
      mode: modeKey,
      amount,
      new_due: newDue,
      transaction_id: toNumber(txnRow?.id),
    });
  } catch (error) {
    console.error("POST /api/landlords/[id]/settle-negative error", error);
    return Response.json(
      { error: "Failed to settle the landlord balance" },
      { status: 500 },
    );
  }
}
