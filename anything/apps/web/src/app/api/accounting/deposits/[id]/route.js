import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * GET /api/accounting/deposits/[id]
 *
 * Fetch details of a single deposit transaction
 */
export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const depositTxnId = toNumber(id);
    if (!depositTxnId) {
      return Response.json({ error: "Invalid deposit ID" }, { status: 400 });
    }

    // Fetch the deposit transaction
    const depositRows = await sql`
      SELECT *
      FROM transactions
      WHERE id = ${depositTxnId}
        AND source_type = 'deposit'
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

    const depositTxn = depositRows?.[0] || null;
    if (!depositTxn) {
      return Response.json({ error: "Deposit not found" }, { status: 404 });
    }

    // Get all transactions that were deposited by this deposit
    const relatedTxns = await sql`
      SELECT t.*, p.tenant_id, tn.full_name AS tenant_name, pr.property_name
      FROM transactions t
      LEFT JOIN payments p ON p.id = t.source_id AND t.source_type = 'payment'
      LEFT JOIN tenants tn ON tn.id = p.tenant_id
      LEFT JOIN properties pr ON pr.id = p.property_id
      WHERE t.deposited_by_transaction_id = ${depositTxnId}
        AND COALESCE(t.is_deleted, false) = false
      ORDER BY t.id
    `;

    return Response.json({
      deposit: depositTxn,
      related_transactions: relatedTxns || [],
    });
  } catch (error) {
    console.error("GET /api/accounting/deposits/[id] error", error);
    return Response.json({ error: "Failed to fetch deposit" }, { status: 500 });
  }
}

/**
 * PUT /api/accounting/deposits/[id]
 *
 * Edit a deposit transaction's date, description, or target account
 */
export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const depositTxnId = toNumber(id);
    if (!depositTxnId) {
      return Response.json({ error: "Invalid deposit ID" }, { status: 400 });
    }

    const body = await request.json();
    const depositDate = (body?.deposit_date || "").trim();
    const description = (body?.description || "").trim();
    const depositToAccountId = toNumber(body?.deposit_to_account_id);

    if (!depositDate && !description && !depositToAccountId) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    // Fetch the existing deposit
    const depositRows = await sql`
      SELECT *
      FROM transactions
      WHERE id = ${depositTxnId}
        AND source_type = 'deposit'
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

    const depositTxn = depositRows?.[0] || null;
    if (!depositTxn) {
      return Response.json(
        { error: "Deposit not found or already deleted" },
        { status: 404 },
      );
    }

    // Build update fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (depositDate) {
      updates.push(`transaction_date = $${paramIndex++}`);
      values.push(depositDate);
    }

    if (description) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (depositToAccountId) {
      updates.push(`debit_account_id = $${paramIndex++}`);
      values.push(depositToAccountId);
    }

    if (updates.length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Add the ID parameter
    values.push(depositTxnId);

    // Update the deposit transaction
    const updateQuery = `
      UPDATE transactions
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
        AND source_type = 'deposit'
        AND COALESCE(is_deleted, false) = false
      RETURNING *
    `;

    const updatedRows = await sql(updateQuery, values);
    const updated = updatedRows?.[0] || null;

    if (!updated) {
      return Response.json(
        { error: "Failed to update deposit" },
        { status: 500 },
      );
    }

    // If deposit account changed, also update the payments table
    if (depositToAccountId) {
      await sql`
        UPDATE payments
        SET deposited_to_account_id = ${depositToAccountId}
        WHERE deposit_transaction_id = ${depositTxnId}
          AND is_reversed = false
      `;
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.deposit.update",
      entityType: "transaction",
      entityId: depositTxnId,
      oldValues: depositTxn,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      deposit: updated,
      message: "Deposit updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/accounting/deposits/[id] error", error);
    return Response.json(
      { error: "Failed to update deposit" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/accounting/deposits/[id]
 *
 * Reverses a deposit transaction by:
 * 1. Soft-deleting the deposit transaction (Dr Bank/Cash, Cr 1130)
 * 2. Clearing deposited_at, deposited_to_account_id, deposit_transaction_id for ALL payments in that batch
 * 3. Clearing deposited_by_transaction_id for all source transactions
 *
 * This moves all payments from the deposit back to Undeposited Funds (1130).
 * You cannot partially reverse - it's all or nothing for the entire deposit batch.
 */
export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const depositTxnId = toNumber(id);
    if (!depositTxnId) {
      return Response.json({ error: "Invalid deposit ID" }, { status: 400 });
    }

    // Fetch the deposit transaction
    const depositRows = await sql`
      SELECT *
      FROM transactions
      WHERE id = ${depositTxnId}
        AND source_type = 'deposit'
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

    const depositTxn = depositRows?.[0] || null;
    if (!depositTxn) {
      return Response.json(
        { error: "Deposit not found or already reversed" },
        { status: 404 },
      );
    }

    await sql.transaction(async (txn) => {
      // 1. Soft-delete the deposit transaction
      await txn`
        UPDATE transactions
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = ${perm.staff.id}
        WHERE id = ${depositTxnId}
      `;

      // 2. Find all payments that were part of this deposit and clear their deposit tracking
      await txn`
        UPDATE payments
        SET deposited_at = NULL,
            deposited_to_account_id = NULL,
            deposit_transaction_id = NULL
        WHERE deposit_transaction_id = ${depositTxnId}
          AND is_reversed = false
      `;

      // 3. Clear deposited_by_transaction_id for all source transactions (marks them as undeposited again)
      await txn`
        UPDATE transactions
        SET deposited_by_transaction_id = NULL
        WHERE deposited_by_transaction_id = ${depositTxnId}
          AND COALESCE(is_deleted, false) = false
      `;
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.deposit.reverse",
      entityType: "transaction",
      entityId: depositTxnId,
      oldValues: depositTxn,
      newValues: { ...depositTxn, is_deleted: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      message:
        "Deposit reversed successfully. All payments moved back to Undeposited Funds.",
    });
  } catch (error) {
    console.error("DELETE /api/accounting/deposits/[id] error", error);
    return Response.json(
      { error: "Failed to reverse deposit" },
      { status: 500 },
    );
  }
}
