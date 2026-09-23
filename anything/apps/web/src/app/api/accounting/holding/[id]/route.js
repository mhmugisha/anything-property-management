import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  getAccountIdByCode,
} from "@/app/api/utils/accounting";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function loadHoldingContext(id) {
  const txId = toNumber(id);
  if (!txId) {
    return {
      ok: false,
      status: 400,
      body: { error: "Invalid holding entry id" },
    };
  }

  const holdingAccountId = await getAccountIdByCode("2500");
  if (!holdingAccountId) {
    return {
      ok: false,
      status: 500,
      body: { error: "Holding (2500) account not found" },
    };
  }

  const rows = await sql`
    SELECT id, amount, transaction_date, reference_number, description,
           debit_account_id, credit_account_id, source_type,
           is_deleted, allocated_by_transaction_id, approval_status
    FROM transactions
    WHERE id = ${txId}
    LIMIT 1
  `;

  const tx = rows?.[0] || null;
  if (!tx) {
    return {
      ok: false,
      status: 404,
      body: { error: "Holding entry not found" },
    };
  }

  if (Number(tx.credit_account_id) !== Number(holdingAccountId)) {
    return {
      ok: false,
      status: 400,
      body: { error: "This transaction is not a Holding entry" },
    };
  }

  if (tx.is_deleted === true) {
    return {
      ok: false,
      status: 409,
      body: { error: "Holding entry has already been deleted" },
    };
  }

  if (
    tx.allocated_by_transaction_id !== null &&
    tx.allocated_by_transaction_id !== undefined
  ) {
    return {
      ok: false,
      status: 409,
      body: {
        error:
          "This Holding entry has been allocated. Reject the allocation first to return it to the worklist, then edit.",
      },
    };
  }

  return { ok: true, txId, tx, holdingAccountId };
}

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const ctx = await loadHoldingContext(params?.id);
    if (!ctx.ok) return Response.json(ctx.body, { status: ctx.status });
    const { txId, tx, holdingAccountId } = ctx;

    const body = await request.json().catch(() => ({}));
    const newAmount = toNumber(body?.amount);
    const newDate = parseDate(body?.transaction_date);
    const hasReference = Object.prototype.hasOwnProperty.call(
      body || {},
      "reference_number",
    );
    const newReference = hasReference
      ? String(body.reference_number || "").trim() || null
      : undefined;
    const hasDescription = Object.prototype.hasOwnProperty.call(
      body || {},
      "description",
    );
    const newDescription = hasDescription
      ? String(body.description || "").trim() || null
      : undefined;

    if (!newAmount || newAmount <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!newDate) {
      return Response.json(
        { error: "transaction_date must be YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const oldAmount = Number(tx.amount || 0);
    if (newAmount > oldAmount) {
      const delta = newAmount - oldAmount;
      const guard = await ensureCanCreditAccount({
        creditAccountId: holdingAccountId,
        amount: delta,
      });
      if (!guard.ok) return Response.json(guard.body, { status: guard.status });
    }

    const nextReference =
      newReference === undefined ? tx.reference_number : newReference;
    const nextDescription =
      newDescription === undefined ? tx.description : newDescription;

    const updated = await sql`
      UPDATE transactions
      SET amount           = ${newAmount},
          transaction_date = ${newDate}::date,
          reference_number = ${nextReference},
          description      = COALESCE(${nextDescription}, description)
      WHERE id = ${txId}
        AND credit_account_id = ${holdingAccountId}
        AND COALESCE(is_deleted, false) = false
        AND allocated_by_transaction_id IS NULL
      RETURNING id, amount, transaction_date, reference_number, description,
                debit_account_id, credit_account_id, source_type,
                is_deleted, allocated_by_transaction_id
    `;

    if (!updated?.length) {
      return Response.json(
        {
          error:
            "This Holding entry has been allocated. Reject the allocation first to return it to the worklist, then edit.",
        },
        { status: 409 },
      );
    }

    const row = updated[0];

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.holding.edit",
      entityType: "transaction",
      entityId: txId,
      oldValues: {
        amount: oldAmount,
        transaction_date: tx.transaction_date,
        reference_number: tx.reference_number,
        description: tx.description,
      },
      newValues: {
        amount: Number(row.amount),
        transaction_date: row.transaction_date,
        reference_number: row.reference_number,
        description: row.description,
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ transaction: row });
  } catch (error) {
    console.error("PUT /api/accounting/holding/[id] error", error);
    return Response.json(
      { error: "Failed to update holding entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const ctx = await loadHoldingContext(params?.id);
    if (!ctx.ok) return Response.json(ctx.body, { status: ctx.status });
    const { txId, tx, holdingAccountId } = ctx;

    const deleted = await sql`
      UPDATE transactions
      SET is_deleted = true,
          deleted_at = now(),
          deleted_by = ${perm.staff.id}
      WHERE id = ${txId}
        AND credit_account_id = ${holdingAccountId}
        AND COALESCE(is_deleted, false) = false
        AND allocated_by_transaction_id IS NULL
      RETURNING id
    `;

    if (!deleted?.length) {
      return Response.json(
        {
          error:
            "This Holding entry has been allocated. Reject the allocation first to return it to the worklist, then delete.",
        },
        { status: 409 },
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.holding.delete",
      entityType: "transaction",
      entityId: txId,
      oldValues: {
        amount: Number(tx.amount || 0),
        transaction_date: tx.transaction_date,
        reference_number: tx.reference_number,
        description: tx.description,
        is_deleted: false,
      },
      newValues: { is_deleted: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true, id: txId });
  } catch (error) {
    console.error("DELETE /api/accounting/holding/[id] error", error);
    return Response.json(
      { error: "Failed to delete holding entry" },
      { status: 500 },
    );
  }
}
