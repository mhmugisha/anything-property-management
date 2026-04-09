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

async function getAccountIdByCode(code) {
  const rows = await sql`
    SELECT id FROM chart_of_accounts WHERE account_code = ${code} LIMIT 1
  `;
  return rows?.[0]?.id || null;
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
    const deductionId = toNumber(id);
    if (!deductionId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const rows = await sql`
      SELECT *
      FROM landlord_deductions
      WHERE id = ${deductionId}
        AND COALESCE(is_deleted,false) = false
      LIMIT 1
    `;

    const deduction = rows?.[0] || null;
    if (!deduction)
      return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({ deduction });
  } catch (error) {
    console.error("GET /api/accounting/landlord-deductions/[id] error", error);
    return Response.json(
      { error: "Failed to fetch landlord deduction" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const deductionId = toNumber(id);
    if (!deductionId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldRows = await sql`
      SELECT *
      FROM landlord_deductions
      WHERE id = ${deductionId}
        AND COALESCE(is_deleted,false) = false
      LIMIT 1
    `;

    const oldDeduction = oldRows?.[0] || null;
    if (!oldDeduction)
      return Response.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();

    const propertyIdRaw = body?.property_id;
    const propertyId = toNumber(propertyIdRaw);

    const deductionDate = (body?.deduction_date || "").trim();
    const description = (body?.description || "").trim();
    const amount = toNumber(body?.amount);
    const paymentSource = (body?.payment_source || "bank").trim(); // bank | cash

    if (!propertyId || !deductionDate || !description || !amount) {
      return Response.json(
        {
          error:
            "property_id, deduction_date, description, and amount are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    const rentPayableId = await getAccountIdByCode("2100");
    const cashId = await getAccountIdByCode("1110");
    const bankId = await getAccountIdByCode("1120");
    const creditAccountId = paymentSource === "cash" ? cashId : bankId;

    if (!rentPayableId || !creditAccountId) {
      return Response.json(
        { error: "Accounting accounts not set up correctly" },
        { status: 500 },
      );
    }

    // NEW: Prevent overpaying landlords when editing a deduction.
    const dueExcludingThis = await getDueToLandlordsBalance({
      landlordId: oldDeduction.landlord_id,
      propertyId,
      excludeDeductionId: deductionId,
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
      WHERE source_type = 'landlord_deduction'
        AND source_id = ${deductionId}
        AND COALESCE(is_deleted,false) = false
      ORDER BY id DESC
      LIMIT 1
    `;

    const oldTx = oldTxRows?.[0] || null;

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

    const updated = await sql.transaction(async (txn) => {
      const deductionRows = await txn`
        UPDATE landlord_deductions
        SET property_id = ${propertyId},
            deduction_date = ${deductionDate}::date,
            description = ${description},
            amount = ${amount}
        WHERE id = ${deductionId}
        RETURNING *
      `;

      const deduction = deductionRows?.[0] || null;

      const txDesc = `Landlord deduction - ${description}`;

      if (oldTx) {
        await txn`
          UPDATE transactions
          SET transaction_date = ${deductionDate}::date,
              description = ${txDesc},
              debit_account_id = ${rentPayableId},
              credit_account_id = ${creditAccountId},
              amount = ${amount},
              property_id = ${propertyId}
          WHERE id = ${oldTx.id}
        `;
      } else {
        await txn`
          INSERT INTO transactions (
            transaction_date, description,
            debit_account_id, credit_account_id,
            amount, currency, created_by,
            landlord_id, property_id,
            expense_scope,
            source_type, source_id
          )
          VALUES (
            ${deductionDate}::date, ${txDesc},
            ${rentPayableId}, ${creditAccountId},
            ${amount}, 'UGX', ${perm.staff.id},
            ${deduction.landlord_id}, ${propertyId},
            'landlord',
            'landlord_deduction', ${deductionId}
          )
        `;
      }

      return deduction;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord_deduction.update",
      entityType: "landlord_deduction",
      entityId: deductionId,
      oldValues: oldDeduction,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ deduction: updated });
  } catch (error) {
    console.error("PUT /api/accounting/landlord-deductions/[id] error", error);
    return Response.json(
      { error: "Failed to update landlord deduction" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const deductionId = toNumber(id);
    if (!deductionId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldRows = await sql`
      SELECT *
      FROM landlord_deductions
      WHERE id = ${deductionId}
        AND COALESCE(is_deleted,false) = false
      LIMIT 1
    `;

    const oldDeduction = oldRows?.[0] || null;
    if (!oldDeduction)
      return Response.json({ error: "Not found" }, { status: 404 });

    await sql.transaction(async (txn) => {
      await txn`
        UPDATE landlord_deductions
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = ${perm.staff.id}
        WHERE id = ${deductionId}
      `;

      await txn`
        UPDATE transactions
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = ${perm.staff.id}
        WHERE source_type = 'landlord_deduction'
          AND source_id = ${deductionId}
          AND COALESCE(is_deleted,false) = false
      `;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord_deduction.delete",
      entityType: "landlord_deduction",
      entityId: deductionId,
      oldValues: oldDeduction,
      newValues: { ...oldDeduction, is_deleted: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      "DELETE /api/accounting/landlord-deductions/[id] error",
      error,
    );
    return Response.json(
      { error: "Failed to delete landlord deduction" },
      { status: 500 },
    );
  }
}
