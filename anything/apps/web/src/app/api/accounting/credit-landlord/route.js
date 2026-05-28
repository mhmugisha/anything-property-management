import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff?.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const landlordId = toNumber(body?.landlord_id);
    const propertyId = toNumber(body?.property_id) || null;
    const amt = toNumber(body?.amount);
    const desc = (body?.description || "").trim();
    const txDate = (body?.transaction_date || "").trim().slice(0, 10);
    const refNumber = (body?.reference_number || "").trim() || null;

    if (!landlordId) {
      return Response.json({ error: "landlord_id is required" }, { status: 400 });
    }
    if (!amt || amt <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!desc) {
      return Response.json({ error: "description is required" }, { status: 400 });
    }
    if (!txDate || !/^\d{4}-\d{2}-\d{2}$/.test(txDate)) {
      return Response.json(
        { error: "transaction_date must be YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const [acct2100Id, acct3200Id] = await Promise.all([
      getAccountIdByCode("2100"),
      getAccountIdByCode("3200"),
    ]);
    if (!acct2100Id)
      return Response.json({ error: "Account 2100 not configured" }, { status: 500 });
    if (!acct3200Id)
      return Response.json({ error: "Account 3200 not configured" }, { status: 500 });

    // Dr 3200 Retained Earnings / Cr 2100 Due to Landlords
    const txnRow = await sql.begin(async (txn) => {
      const [row] = await txn`
        INSERT INTO transactions (
          transaction_date, description,
          debit_account_id, credit_account_id,
          amount, currency,
          created_by, landlord_id, property_id,
          reference_number, source_type, approval_status
        ) VALUES (
          ${txDate}::date, ${desc},
          ${acct3200Id}, ${acct2100Id},
          ${amt}, 'UGX',
          ${perm.staff.id}, ${landlordId}, ${propertyId},
          ${refNumber}, 'landlord_credit', 'approved'
        ) RETURNING id
      `;
      return row;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord_credit.create",
      entityType: "transaction",
      entityId: toNumber(txnRow?.id),
      oldValues: null,
      newValues: {
        landlord_id: landlordId,
        property_id: propertyId,
        amount: amt,
        description: desc,
        transaction_date: txDate,
        reference_number: refNumber,
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true, transaction_id: Number(txnRow?.id) });
  } catch (error) {
    console.error("POST /api/accounting/credit-landlord error", error);
    return Response.json(
      { error: "Failed to post landlord credit" },
      { status: 500 },
    );
  }
}
