import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureCanCreditAccount } from "@/app/api/utils/accounting";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const paymentId = toNumber(id);
    if (!paymentId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const rows = await sql`
      SELECT p.*, pia.invoice_id, pia.amount_applied
      FROM payments p
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      WHERE p.id = ${paymentId}
      LIMIT 1
    `;

    const payment = rows?.[0] || null;
    if (!payment || payment.is_reversed === true) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ payment });
  } catch (error) {
    console.error("GET /api/payments/[id] error", error);
    return Response.json({ error: "Failed to fetch payment" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const paymentId = toNumber(id);
    if (!paymentId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    // Use LEFT JOIN to support both invoice payments and upfront payments
    const oldRows = await sql`
      SELECT p.*, pia.invoice_id, pia.amount_applied
      FROM payments p
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      WHERE p.id = ${paymentId}
      LIMIT 1
    `;

    const oldPayment = oldRows?.[0] || null;
    if (!oldPayment || oldPayment.is_reversed === true) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Block editing if payment has been deposited (legacy flow)
    if (oldPayment.deposited_at || oldPayment.deposit_transaction_id) {
      return Response.json(
        {
          error:
            "Cannot edit a deposited payment. Reverse the deposit first from the bank",
        },
        { status: 400 },
      );
    }

    // Block editing if payment has been deposited (new flow: check transactions)
    const depositedTxRows = await sql`
      SELECT id
      FROM transactions
      WHERE source_type = 'payment'
        AND source_id = ${paymentId}
        AND deposited_by_transaction_id IS NOT NULL
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

    if (depositedTxRows && depositedTxRows.length > 0) {
      return Response.json(
        {
          error:
            "Cannot edit a deposited payment. Reverse the deposit first from the bank",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const paymentDate = (body?.payment_date || "").trim();
    const amount = toNumber(body?.amount);
    const paymentMethod = (body?.payment_method || "").trim();
    const notes = (body?.notes || "").trim() || null;
    const referenceNumber = (body?.reference_number || "").trim() || null;

    if (!paymentDate || !amount || !paymentMethod) {
      return Response.json(
        { error: "payment_date, amount, and payment_method are required" },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // payments has no invoice_id column — allocations live in their own table.
    const allocations = await sql`
      SELECT id, invoice_id, amount_applied
      FROM payment_invoice_allocations
      WHERE payment_id = ${paymentId}
    `;

    const allocationCount = allocations?.length || 0;

    if (allocationCount === 0) {
      // No invoice linked: only metadata fields may change, not amount.
      const oldAmount = Number(oldPayment.amount || 0);
      if (Number(amount) !== oldAmount) {
        return Response.json(
          {
            error:
              "Cannot change amount on a payment with no invoice allocation. Delete and re-create the payment instead.",
          },
          { status: 400 },
        );
      }

      const [updatedPaymentRows] = await sql.transaction((txn) => [
        txn`
          UPDATE payments
          SET payment_date = ${paymentDate}::date,
              payment_method = ${paymentMethod},
              reference_number = ${referenceNumber},
              notes = ${notes}
          WHERE id = ${paymentId}
          RETURNING *
        `,
      ]);
      const txResult = {
        payment: updatedPaymentRows?.[0] || null,
        invoice: null,
      };

      await writeAuditLog({
        staffId: perm.staff.id,
        action: "payment.update",
        entityType: "payment",
        entityId: paymentId,
        oldValues: oldPayment,
        newValues: txResult.payment,
        ipAddress: perm.ipAddress,
      });

      return Response.json(txResult);
    }

    if (allocationCount >= 2) {
      return Response.json(
        {
          error:
            "Editing split payments (allocated to multiple invoices) is not supported. To make changes: click Delete to reverse this payment cleanly, then record fresh payments for each invoice.",
        },
        { status: 400 },
      );
    }

    // allocationCount === 1: full edit — update payment, allocation, invoice, and ledger.
    const allocation = allocations[0];
    const invoiceId = Number(allocation.invoice_id);

    // Handle invoice payment update
    const invoiceRows = await sql`
      SELECT *
      FROM invoices
      WHERE id = ${invoiceId}
      LIMIT 1
    `;

    const invoice = invoiceRows?.[0] || null;
    if (!invoice)
      return Response.json({ error: "Invoice not found" }, { status: 404 });

    // Validate the new amount
    const oldPaymentAmount = Number(oldPayment.amount || 0);
    const newAmount = Number(amount);

    // Calculate how much space is available on the invoice after removing this payment's current contribution
    const invoiceTotal = Number(invoice.amount || 0);
    const currentPaidAmount = Number(invoice.paid_amount || 0);
    const maxAllowed = invoiceTotal - currentPaidAmount + oldPaymentAmount;

    if (newAmount > maxAllowed) {
      return Response.json(
        {
          error: `Payment cannot exceed invoice outstanding. Invoice total: ${invoiceTotal.toLocaleString()}, currently paid: ${currentPaidAmount.toLocaleString()}, you can apply up to: ${maxAllowed.toLocaleString()}`,
        },
        { status: 400 },
      );
    }

    const delta = newAmount - oldPaymentAmount;

    // If reducing the payment, we're effectively crediting Undeposited Funds.
    const undRes = await resolveAccountIntent("undeposited_funds");
    const undepositedFundsAccountId = undRes.ok
      ? Number(undRes.accountId)
      : null;

    if (!undepositedFundsAccountId) {
      return Response.json(
        { error: "Undeposited Funds account not set up" },
        { status: 500 },
      );
    }

    if (delta < 0) {
      const guard = await ensureCanCreditAccount({
        creditAccountId: undepositedFundsAccountId,
        amount: Math.abs(delta),
      });
      if (!guard.ok) {
        return Response.json(guard.body, { status: guard.status });
      }
    }

    // Pre-fetch linked accounting transactions before the transaction because the neon()
    // HTTP client requires transaction() to receive a synchronous array of queries.
    const linked = await sql`
      SELECT id, debit_account_id, credit_account_id
      FROM transactions
      WHERE source_type = 'payment'
        AND source_id = ${paymentId}
        AND COALESCE(is_deleted,false) = false
    `;

    let rentReceivableId = null;
    let rentPayableId = null;
    let mgmtFeesId = null;

    if (linked && linked.length > 0) {
      const rentRecvRes = await resolveAccountIntent("tenant_receivable");
      const rentPayableRes = await resolveAccountIntent("landlord_liability");
      const mgmtIncRes = await resolveAccountIntent("management_fee_income");

      rentReceivableId = rentRecvRes.ok ? Number(rentRecvRes.accountId) : null;
      rentPayableId = rentPayableRes.ok ? Number(rentPayableRes.accountId) : null;
      mgmtFeesId = mgmtIncRes.ok ? Number(mgmtIncRes.accountId) : null;

      if (!rentReceivableId || !rentPayableId || !mgmtFeesId) {
        return Response.json(
          { error: "Accounting bindings missing for payment update" },
          { status: 500 },
        );
      }
    }

    const txResults = await sql.transaction((txn) => {
      const queries = [
        txn`
          UPDATE payments
          SET payment_date = ${paymentDate}::date,
              amount = ${amount},
              payment_method = ${paymentMethod},
              reference_number = ${referenceNumber},
              notes = ${notes}
          WHERE id = ${paymentId}
          RETURNING *
        `,
        txn`
          UPDATE payment_invoice_allocations
          SET amount_applied = ${amount}
          WHERE id = ${allocation.id}
        `,
        txn`
          UPDATE invoices
          SET paid_amount = paid_amount + ${delta},
              status = CASE
                WHEN (paid_amount + ${delta}) >= amount THEN 'paid'
                ELSE 'open'
              END
          WHERE id = ${invoiceId}
          RETURNING *
        `,
      ];

      if (linked && linked.length > 0) {
        // Update receipt row amount/date and normalize to Cr Rent Receivable.
        // New scheme (accrual): receipt is Dr 1130, Cr 1210.
        // Legacy scheme (older data): receipt is Dr 1130, Cr 2100 and a separate commission row.
        queries.push(txn`
          UPDATE transactions
          SET transaction_date = ${paymentDate}::date,
              amount = ${amount},
              debit_account_id = ${undepositedFundsAccountId},
              credit_account_id = ${rentReceivableId}
          WHERE source_type = 'payment'
            AND source_id = ${paymentId}
            AND debit_account_id = ${undepositedFundsAccountId}
            AND credit_account_id IN (${rentReceivableId}, ${rentPayableId})
            AND COALESCE(is_deleted,false) = false
        `);

        // Always remove any legacy commission rows tied to this payment.
        queries.push(txn`
          UPDATE transactions
          SET is_deleted = true,
              deleted_at = now(),
              deleted_by = ${perm.staff.id}
          WHERE source_type = 'payment'
            AND source_id = ${paymentId}
            AND debit_account_id = ${rentPayableId}
            AND credit_account_id = ${mgmtFeesId}
            AND COALESCE(is_deleted,false) = false
        `);
      }

      return queries;
    });

    const txResult = {
      payment: txResults[0]?.[0] || null,
      invoice: txResults[2]?.[0] || null,
    };

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "payment.update",
      entityType: "payment",
      entityId: paymentId,
      oldValues: oldPayment,
      newValues: txResult.payment,
      ipAddress: perm.ipAddress,
    });

    return Response.json(txResult);
  } catch (error) {
    console.error("PUT /api/payments/[id] error", error);
    return Response.json(
      { error: "Failed to update payment" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const paymentId = toNumber(id);
    if (!paymentId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const staffId = perm.staff?.id;
    if (!staffId) {
      return Response.json({ error: "Staff ID is required" }, { status: 401 });
    }

    // Fetch payment first (do NOT require an invoice allocation to exist).
    const paymentRows = await sql`
      SELECT *
      FROM payments
      WHERE id = ${paymentId}
      LIMIT 1
    `;

    const oldPayment = paymentRows?.[0] || null;
    if (!oldPayment) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Idempotent delete: if already reversed, treat as success.
    if (oldPayment.is_reversed === true) {
      return Response.json({
        ok: true,
        message: "Payment deleted successfully",
        alreadyDeleted: true,
      });
    }

    // Block deletion if payment has been deposited (legacy flow)
    if (oldPayment.deposited_at || oldPayment.deposit_transaction_id) {
      return Response.json(
        {
          error:
            "Cannot delete a deposited payment. Reverse first from the bank",
        },
        { status: 400 },
      );
    }

    // Block deletion if payment has been deposited (new flow: check transactions)
    const depositedTxRows = await sql`
      SELECT id
      FROM transactions
      WHERE source_type = 'payment'
        AND source_id = ${paymentId}
        AND deposited_by_transaction_id IS NOT NULL
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `;

    if (depositedTxRows && depositedTxRows.length > 0) {
      return Response.json(
        {
          error:
            "Cannot delete a deposited payment. Reverse first from the bank",
        },
        { status: 400 },
      );
    }

    // Capture allocation ids + per-invoice deltas BEFORE we delete anything,
    // so we can soft-delete payment_auto_apply entries by allocation_id even
    // after the allocation rows are gone.
    const allocations = await sql`
      SELECT id, invoice_id, amount_applied
      FROM payment_invoice_allocations
      WHERE payment_id = ${paymentId}
    `;

    const allocationIds = (allocations || []).map((a) => a.id);

    try {
      await sql.transaction((txn) => {
        const queries = [];

        // 1. Mark payment reversed.
        queries.push(txn`
          UPDATE payments
          SET is_reversed = true,
              reversed_by = ${staffId},
              reversed_at = now()
          WHERE id = ${paymentId}
        `);

        // 2. Reverse each invoice's paid_amount and status.
        for (const a of allocations || []) {
          const invoiceId = toNumber(a?.invoice_id);
          const applied = Number(a?.amount_applied || 0);
          if (!invoiceId || !Number.isFinite(applied) || applied <= 0) continue;

          queries.push(txn`
            UPDATE invoices
            SET paid_amount = GREATEST(0, paid_amount - ${applied}),
                status = CASE
                  WHEN (GREATEST(0, paid_amount - ${applied})) >= amount THEN 'paid'
                  ELSE 'open'
                END
            WHERE id = ${invoiceId}
          `);
        }

        // 3. Delete the allocation rows.
        queries.push(txn`
          DELETE FROM payment_invoice_allocations
          WHERE payment_id = ${paymentId}
        `);

        // 4. Soft-delete 'payment' ledger entries (Pay Invoice flow).
        queries.push(txn`
          UPDATE transactions
          SET is_deleted = true,
              deleted_at = now(),
              deleted_by = ${staffId}
          WHERE source_type = 'payment'
            AND source_id = ${paymentId}
            AND COALESCE(is_deleted, false) = false
        `);

        // 5. Soft-delete 'payment_advance' ledger entries (Pay-on-Account credit).
        queries.push(txn`
          UPDATE transactions
          SET is_deleted = true,
              deleted_at = now(),
              deleted_by = ${staffId}
          WHERE source_type = 'payment_advance'
            AND source_id = ${paymentId}
            AND COALESCE(is_deleted, false) = false
        `);

        // 6. Soft-delete 'payment_auto_apply' ledger entries (keyed by allocation_id).
        if (allocationIds.length > 0) {
          queries.push(txn`
            UPDATE transactions
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = ${staffId}
            WHERE source_type = 'payment_auto_apply'
              AND source_id = ANY(${allocationIds}::int[])
              AND COALESCE(is_deleted, false) = false
          `);
        }

        return queries;
      });
    } catch (txnErr) {
      return Response.json(
        { error: `Payment deletion failed: ${txnErr.message}` },
        { status: 500 },
      );
    }

    // Audit log runs only after the transaction commits successfully.
    await writeAuditLog({
      staffId: staffId,
      action: "payment.delete",
      entityType: "payment",
      entityId: paymentId,
      oldValues: oldPayment,
      newValues: { ...oldPayment, is_reversed: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true, message: "Payment deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/payments/[id] error", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      paymentId: id,
    });
    return Response.json(
      { error: error?.message || "Failed to delete payment" },
      { status: 500 },
    );
  }
}
