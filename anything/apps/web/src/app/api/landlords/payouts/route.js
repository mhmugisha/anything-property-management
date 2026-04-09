import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const landlordId = toNumber(body?.landlord_id);
    const propertyId = toNumber(body?.property_id);
    const payoutDate = (body?.payout_date || "").trim();
    const amount = toNumber(body?.amount);
    const method = (body?.payment_method || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;
    const notes = (body?.notes || "").trim() || null;

    if (!landlordId || !propertyId || !payoutDate || !amount || !method) {
      return Response.json(
        {
          error:
            "landlord_id, property_id, payout_date, amount, payment_method are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // Get landlord name for the transaction description
    const landlordRows = await sql`
      SELECT full_name FROM landlords WHERE id = ${landlordId} LIMIT 1
    `;
    const landlordName = landlordRows?.[0]?.full_name || "Unknown Landlord";

    // FIX: Detect cash vs bank based on method containing "cash" (case-insensitive)
    // This handles both "Cash" and "Cash on Hand"
    const isCash = method.toLowerCase().includes("cash");
    const creditIntent = isCash ? "cash_account" : "bank_account";

    const creditRes = await resolveAccountIntent(creditIntent);
    if (!creditRes.ok) {
      return Response.json(
        { error: `Could not resolve ${creditIntent} account` },
        { status: 500 },
      );
    }

    const creditAccountId = Number(creditRes.accountId);

    // Prevent paying out money that isn't available in the credited Asset account.
    // This checks account 1110 (Cash on Hand) if isCash=true, or 1120 (Bank) otherwise.
    const guard = await ensureCanCreditAccount({
      creditAccountId,
      amount,
    });
    if (!guard.ok) {
      return Response.json(guard.body, { status: guard.status });
    }

    // Prevent overpaying landlords (cannot pay more than currently due).
    const due = await getDueToLandlordsBalance({
      landlordId,
      propertyId,
    });
    if (amount > Number(due || 0)) {
      return Response.json(
        {
          error: `Overpayment blocked. Due to landlords for this property is ${Number(due || 0)} UGX.`,
        },
        { status: 400 },
      );
    }

    const rows = await sql`
      INSERT INTO landlord_payouts (
        landlord_id, property_id, payout_date,
        amount, payment_method, reference_number, notes,
        created_by,
        is_deleted
      )
      VALUES (
        ${landlordId}, ${propertyId}, ${payoutDate}::date,
        ${amount}, ${method}, ${referenceNumber}, ${notes},
        ${perm.staff.id},
        false
      )
      RETURNING *
    `;

    const payout = rows?.[0] || null;

    const desc = `Landlord payout - ${landlordName}`;

    const post = await postAccountingEntryFromIntents({
      transactionDate: payoutDate,
      description: desc,
      referenceNumber: referenceNumber,
      debitIntent: "landlord_liability",
      creditIntent,
      amount,
      currency: "UGX",
      createdBy: perm.staff.id,
      landlordId,
      propertyId,
      sourceType: "landlord_payout",
      sourceId: payout.id,
      auditContext: {
        sourceModule: "property",
        businessEvent: "LANDLORD_PAID",
        sourceEntity: { type: "landlord_payout", id: payout.id },
      },
    });

    if (!post.ok) {
      throw new Error(
        `Accounting posting failed: ${post.error || "unknown error"}`,
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.payout.create",
      entityType: "landlord_payout",
      entityId: payout?.id || null,
      oldValues: null,
      newValues: payout,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about landlord payout
    // Get landlord and property details for notification
    if (payout?.id) {
      const detailsRows = await sql`
        SELECT 
          l.full_name AS landlord_name,
          p.property_name
        FROM landlord_payouts lp
        JOIN landlords l ON l.id = lp.landlord_id
        JOIN properties p ON p.id = lp.property_id
        WHERE lp.id = ${payout.id}
        LIMIT 1
      `;

      const details = detailsRows?.[0];
      if (details) {
        notifyAllAdminsAsync({
          title: "Landlord Payout Recorded",
          message: `Payout of UGX ${Number(amount).toLocaleString()} recorded for ${details.landlord_name} (${details.property_name}) via ${method}. Recorded by ${perm.staff.full_name || "Staff"}`,
          type: "payout",
          reference_id: payout.id,
          reference_type: "landlord_payout",
        });
      }
    }

    return Response.json({ payout });
  } catch (error) {
    console.error("POST /api/landlords/payouts error", error);
    return Response.json(
      { error: error?.message || "Failed to record landlord payout" },
      { status: 500 },
    );
  }
}
