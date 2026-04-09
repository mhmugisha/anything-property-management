import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getDueToLandlordsBalance,
} from "@/app/api/utils/accounting";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const landlordId = toNumber(body?.landlord_id);
    const propertyId = toNumber(body?.property_id);
    const deductionDate = (body?.deduction_date || "").trim();
    const description = (body?.description || "").trim();
    const amount = toNumber(body?.amount);
    const paymentAccountId = toNumber(body?.payment_account_id);

    if (
      !landlordId ||
      !propertyId ||
      !deductionDate ||
      !description ||
      !amount ||
      !paymentAccountId
    ) {
      return Response.json(
        {
          error:
            "landlord_id, property_id, deduction_date, description, amount, and payment_account_id are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // Validate that the payment account exists and is one of the allowed accounts (1110 or 1120)
    const accountCheck = await sql`
      SELECT id, account_code, account_name 
      FROM chart_of_accounts 
      WHERE id = ${paymentAccountId} 
        AND account_code IN ('1110', '1120')
        AND COALESCE(is_active, true) = true
    `;

    if (accountCheck.length === 0) {
      return Response.json(
        {
          error:
            "Invalid payment account. Must be Cash on Hand (1110) or Bank Account - Operating (1120)",
        },
        { status: 400 },
      );
    }

    const accountCode = accountCheck[0].account_code;
    const creditAccountId = paymentAccountId;

    // Map account code to credit intent
    let creditIntent;
    if (accountCode === "1110") {
      creditIntent = "cash_account";
    } else if (accountCode === "1120") {
      creditIntent = "bank_account";
    } else {
      return Response.json(
        { error: "Invalid payment account code" },
        { status: 400 },
      );
    }

    // Prevent spending more than what's available in the credited Asset account.
    console.log("Checking if can credit account", { creditAccountId, amount });
    const guard = await ensureCanCreditAccount({
      creditAccountId,
      amount,
    });
    if (!guard.ok) {
      console.error("ensureCanCreditAccount failed:", guard.body);
      return Response.json(guard.body, { status: guard.status });
    }

    // Prevent overpaying landlords (deductions also reduce what's due to landlords).
    console.log("Checking landlord balance", { landlordId, propertyId });
    const due = await getDueToLandlordsBalance({
      landlordId,
      propertyId,
    });
    console.log("Due to landlords:", due);
    if (amount > Number(due || 0)) {
      return Response.json(
        {
          error: `Overpayment blocked. Due to landlords for this property is ${Number(due || 0)} UGX.`,
        },
        { status: 400 },
      );
    }

    const deductionRows = await sql`
      INSERT INTO landlord_deductions (
        landlord_id, property_id, deduction_date,
        description, amount, created_by,
        is_deleted
      )
      VALUES (
        ${landlordId}, ${propertyId}, ${deductionDate}::date,
        ${description}, ${amount}, ${perm.staff.id},
        false
      )
      RETURNING *
    `;

    const deduction = deductionRows?.[0] || null;

    // Accounting: reduce landlord payable and reduce cash/bank
    const txDesc = `Landlord deduction - ${description}`;

    console.log("Posting accounting entry...");
    const post = await postAccountingEntryFromIntents({
      transactionDate: deductionDate,
      description: txDesc,
      referenceNumber: null,
      debitIntent: "landlord_liability",
      creditIntent, // Use creditIntent instead of creditAccountId
      amount,
      currency: "UGX",
      createdBy: perm.staff.id,
      landlordId,
      propertyId,
      expenseScope: "landlord",
      sourceType: "landlord_deduction",
      sourceId: deduction.id,
      auditContext: {
        sourceModule: "accounting",
        businessEvent: "LANDLORD_DEDUCTION",
        sourceEntity: { type: "landlord_deduction", id: deduction.id },
      },
    });

    if (!post.ok) {
      console.error("postAccountingEntryFromIntents failed:", post.error);
      // Return the specific error from the posting adapter instead of throwing
      return Response.json(
        { error: post.error || "Accounting posting failed" },
        { status: 500 },
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord_deduction.create",
      entityType: "landlord_deduction",
      entityId: deduction?.id || null,
      oldValues: null,
      newValues: deduction,
      ipAddress: perm.ipAddress,
    });

    // Keep existing audit event name for transaction create, but now we use the created transaction from CIL.
    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transaction.create",
      entityType: "transaction",
      entityId: post.transaction?.id || null,
      oldValues: null,
      newValues: post.transaction,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ deduction, transaction: post.transaction });
  } catch (error) {
    console.error("POST /api/accounting/landlord-deductions error", error);
    // Include the actual error message in the response
    const errorMessage =
      error?.message || "Failed to create landlord deduction";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
