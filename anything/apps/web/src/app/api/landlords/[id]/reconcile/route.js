import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff?.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const { action, amount, description, transaction_date, month, year } = body;

    if (!["credit", "deduction"].includes(action)) {
      return Response.json(
        { error: "action must be 'credit' or 'deduction'" },
        { status: 400 },
      );
    }
    const amt = toNumber(amount);
    if (!amt || amt <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    const desc = (description || "").trim();
    if (!desc) {
      return Response.json({ error: "description is required" }, { status: 400 });
    }
    if (!transaction_date) {
      return Response.json(
        { error: "transaction_date is required" },
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

    // credit: Dr 3200 Retained Earnings / Cr 2100 Due to Landlords
    // deduction: Dr 2100 Due to Landlords / Cr 3200 Retained Earnings
    const debitId = action === "credit" ? acct3200Id : acct2100Id;
    const creditId = action === "credit" ? acct2100Id : acct3200Id;
    const txDate = String(transaction_date).slice(0, 10);

    const txnRow = await sql.begin(async (txn) => {
      const [row] = await txn`
        INSERT INTO transactions (
          transaction_date, description,
          debit_account_id, credit_account_id,
          amount, currency,
          created_by, landlord_id,
          source_type, approval_status
        ) VALUES (
          ${txDate}::date, ${desc},
          ${debitId}, ${creditId},
          ${amt}, 'UGX',
          ${perm.staff.id}, ${landlordId},
          'reconciliation', 'approved'
        ) RETURNING id
      `;
      return row;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "reconciliation.apply",
      entityType: "transaction",
      entityId: toNumber(txnRow?.id),
      oldValues: null,
      newValues: { action, amount: amt, description: desc, month, year, landlord_id: landlordId },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true, transaction_id: Number(txnRow?.id) });
  } catch (error) {
    console.error("POST /api/landlords/[id]/reconcile error", error);
    return Response.json(
      { error: "Failed to apply reconciliation" },
      { status: 500 },
    );
  }
}
