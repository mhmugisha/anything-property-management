import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  getAccountById,
  ensureCanCreditAccount,
} from "@/app/api/utils/accounting";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";

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

    const transferDate = (body?.transfer_date || "").trim();
    const amount = toNumber(body?.amount);
    const description = (body?.description || "").trim();
    const fromAccountId = toNumber(body?.from_account_id);
    const toAccountId = toNumber(body?.to_account_id);

    // Validation
    if (
      !transferDate ||
      !amount ||
      !description ||
      !fromAccountId ||
      !toAccountId
    ) {
      return Response.json(
        {
          error:
            "All fields are required: transfer_date, amount, description, from_account_id, to_account_id",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    if (fromAccountId === toAccountId) {
      return Response.json(
        { error: "Cannot transfer to the same account" },
        { status: 400 },
      );
    }

    // Verify both accounts exist
    const fromAccount = await getAccountById(fromAccountId);
    const toAccount = await getAccountById(toAccountId);

    if (!fromAccount) {
      return Response.json(
        { error: "Source account not found" },
        { status: 404 },
      );
    }

    if (!toAccount) {
      return Response.json(
        { error: "Destination account not found" },
        { status: 404 },
      );
    }

    if (!fromAccount.is_active || !toAccount.is_active) {
      return Response.json(
        { error: "Cannot transfer to/from inactive accounts" },
        { status: 400 },
      );
    }

    // Check if the source account has sufficient funds (only for asset accounts)
    const fromAccountType = (fromAccount.account_type || "").trim();
    if (fromAccountType === "Asset") {
      const guard = await ensureCanCreditAccount({
        creditAccountId: fromAccountId,
        amount,
      });
      if (!guard.ok) {
        return Response.json(guard.body, { status: guard.status });
      }
    }

    // Create the transfer transaction
    // Debit the destination account (increases its balance if asset)
    // Credit the source account (decreases its balance if asset)
    const approval = getApprovalFields(perm.staff);
    const result = await sql`
      INSERT INTO transactions (
        transaction_date,
        description,
        reference_number,
        debit_account_id,
        credit_account_id,
        amount,
        currency,
        created_by,
        source_type,
        approval_status, approved_by, approved_at
      )
      VALUES (
        ${transferDate}::date,
        ${description},
        ${`TRANSFER-${Date.now()}`},
        ${toAccountId},
        ${fromAccountId},
        ${amount},
        'UGX',
        ${perm.staff.id},
        'manual',
        ${approval.approval_status}, ${approval.approved_by}, ${approval.approved_at}
      )
      RETURNING *
    `;

    const transaction = result?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transfer.create",
      entityType: "transaction",
      entityId: transaction?.id || null,
      oldValues: null,
      newValues: transaction,
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      transaction,
      message: "Transfer completed successfully",
    });
  } catch (error) {
    console.error("POST /api/accounting/transfers error", error);
    return Response.json(
      { error: error?.message || "Failed to create transfer" },
      { status: 500 },
    );
  }
}
