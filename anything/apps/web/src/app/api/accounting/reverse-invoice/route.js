import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoiceAccrualLedgerEntries } from "@/app/api/utils/invoices/invoiceAccrualLedger";
import {
  getInvoiceLiveApplied,
  getInvoiceLiveAppliedPayments,
} from "@/app/api/utils/payments/liveAllocations";

function toNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const invoiceId = toNumber(body?.invoice_id);
    let tenantId = toNumber(body?.tenant_id);
    const reversalDate = (body?.reversal_date || "").trim();
    const description =
      (body?.description || "").trim() || "Rent invoice reversal";
    let amount = toNumber(body?.amount);
    const currency = "UGX"; // Hardcoded to UGX only

    if (!invoiceId || !reversalDate) {
      return Response.json(
        { error: "invoice_id and reversal_date are required" },
        { status: 400 },
      );
    }

    const invoiceRows = await sql`
      SELECT
        i.tenant_id, i.property_id, i.lease_id,
        i.invoice_year, i.invoice_month,
        i.amount, i.currency, i.description, i.paid_amount, i.status
      FROM invoices i
      WHERE i.id = ${invoiceId}
        AND COALESCE(i.is_deleted, false) = false
      LIMIT 1
    `;

    if (!invoiceRows || invoiceRows.length === 0) {
      return Response.json(
        { error: "Invoice not found or already deleted" },
        { status: 404 },
      );
    }

    const invoice = invoiceRows[0];

    // Check if invoice is already void
    if (invoice.status === "void") {
      return Response.json(
        { error: "Invoice is already voided and cannot be reversed" },
        { status: 400 },
      );
    }

    const originalInvoiceAmount = toNumber(invoice.amount);
    const paidAmount = toNumber(invoice.paid_amount) || 0;
    const unpaidBalance = originalInvoiceAmount - paidAmount;

    tenantId = tenantId || toNumber(invoice.tenant_id);
    // Scope by the invoice's own property, never the request body's.
    const propertyId = toNumber(invoice.property_id);
    amount = amount || unpaidBalance;

    if (!tenantId || !amount || amount <= 0) {
      return Response.json(
        { error: "Invalid invoice data or reversal amount" },
        { status: 400 },
      );
    }

    // Key validation: reversal amount cannot exceed unpaid balance
    if (amount > unpaidBalance) {
      return Response.json(
        {
          error: `Cannot reverse ${amount.toLocaleString()} ${currency}. Unpaid balance is only ${unpaidBalance.toLocaleString()} ${currency} (Invoice: ${originalInvoiceAmount.toLocaleString()}, Paid: ${paidAmount.toLocaleString()})`,
        },
        { status: 400 },
      );
    }

    // Void guard: if this reversal would set status='void' AND there is any
    // live payment allocation attached, reject. Uses live_applied (sum of
    // non-reversed, approved payment allocations) as the ledger truth so it
    // catches the drift case where invoices.paid_amount reads 0 but real
    // money is still attached via allocations.
    const wouldSetStatusVoid =
      unpaidBalance - amount <= 0.01 && paidAmount === 0;
    if (wouldSetStatusVoid) {
      const liveApplied = await getInvoiceLiveApplied(invoiceId);
      if (liveApplied > 0) {
        const appliedPayments = await getInvoiceLiveAppliedPayments(invoiceId);
        return Response.json(
          {
            error:
              "This invoice has a payment applied to it and can't be voided. Un-apply or reverse the payment first, then void.",
            live_applied: liveApplied,
            applied_payments: appliedPayments,
          },
          { status: 409 },
        );
      }
    }

    // Partial reversals reduce the invoice by exactly the requested amount.
    // Only an unpaid invoice reversed in full is voided; when money has been
    // paid, the paid portion is kept and the rest written off.
    const isFullReversal = wouldSetStatusVoid;
    const newInvoiceAmount = isFullReversal
      ? originalInvoiceAmount
      : originalInvoiceAmount - amount;
    const newStatus = isFullReversal
      ? "void"
      : newInvoiceAmount - paidAmount <= 0.01
        ? "paid"
        : "open";

    // Edit floor: the invoice amount must never drop below the amount of
    // live payments allocated to it. Use live_applied (allocations against
    // non-reversed, approved payments) rather than paid_amount alone,
    // because paid_amount can drift and understate reality.
    if (!isFullReversal) {
      const liveApplied = await getInvoiceLiveApplied(invoiceId);
      const floor = Math.max(paidAmount, liveApplied);
      if (newInvoiceAmount + 0.01 < floor) {
        const appliedPayments = await getInvoiceLiveAppliedPayments(invoiceId);
        return Response.json(
          {
            error: `Cannot reduce invoice below live payments applied (${floor.toLocaleString()} ${currency}). Un-apply or reverse the payment first.`,
            live_applied: liveApplied,
            paid_amount: paidAmount,
            applied_payments: appliedPayments,
          },
          { status: 409 },
        );
      }
    }

    // The only write. It applies only if the invoice is unchanged since it
    // was read, so a payment landing in between can't be overwritten.
    const updatedRows = await sql`
      UPDATE invoices
      SET amount = ${newInvoiceAmount}, status = ${newStatus}
      WHERE id = ${invoiceId}
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(status, '') = ${invoice.status ?? ""}
        AND amount = ${originalInvoiceAmount}
        AND COALESCE(paid_amount, 0) = ${paidAmount}
      RETURNING id, amount, paid_amount, status
    `;
    if (!updatedRows || updatedRows.length === 0) {
      return Response.json(
        {
          error:
            "This invoice changed while it was being reversed. Reload and try again.",
        },
        { status: 409 },
      );
    }
    const updated = updatedRows[0];

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "invoice.reverse",
      entityType: "invoice",
      entityId: invoiceId,
      oldValues: {
        amount: originalInvoiceAmount,
        paid_amount: paidAmount,
        status: invoice.status,
      },
      newValues: {
        amount: Number(updated.amount),
        paid_amount: Number(updated.paid_amount),
        status: updated.status,
        reversed_amount: amount,
        reversal_date: reversalDate,
        description,
      },
      ipAddress: perm.ipAddress,
    });

    // Reversed rent leaves 2100 and 1210 (and the fee leaves 4100) through
    // the accrual sync: it recomputes each property-month from live invoices,
    // moving each account once. Lease invoices resync their lease's
    // properties; arrears invoices (no lease) resync their property. The
    // invoice is already updated, so a failure is reported, not raised.
    const warnings = [];
    const accrualScope = invoice.lease_id
      ? { force: true, leaseId: toNumber(invoice.lease_id) }
      : { force: true, propertyId };
    try {
      const resync = await ensureInvoiceAccrualLedgerEntries(accrualScope);
      // The wrapper returns only counts. CIL switched off, unresolved
      // accounts and a failed sync all come back as zeros without throwing.
      // A forced scoped run upserts every live month on its properties, so
      // all zeros means nothing was posted.
      const posted =
        Number(resync?.insertedCount || 0) +
        Number(resync?.updatedCount || 0) +
        Number(resync?.voidedCount || 0);
      if (posted === 0) {
        console.error(
          "reverse-invoice: accrual resync posted nothing after reversal",
          { invoiceId, accrualScope, resync },
        );
        warnings.push(
          "Invoice reversed, but the rent accrual resync posted nothing (accrual engine off, accounts unresolved, or sync failed) — Due to Landlords and tenant receivables may be out of date until the next sync.",
        );
      }
    } catch (resyncError) {
      console.error("reverse-invoice: accrual resync failed after reversal", {
        invoiceId,
        accrualScope,
        error: resyncError,
      });
      warnings.push(
        "Invoice reversed, but the rent accrual resync failed — Due to Landlords and tenant receivables may be briefly out of date until the next sync.",
      );
    }

    // The resync skips clearing a month that still carries an old
    // rent_reversal, so check this invoice's month directly: its accrual row
    // must equal the live invoices in it.
    const year = toNumber(invoice.invoice_year);
    const month = toNumber(invoice.invoice_month);
    if (propertyId && year && month) {
      const invoiceCurrency = String(invoice.currency || "UGX").trim() || "UGX";
      const accrualRef = `RENT-ACCRUAL:${propertyId}:${year}-${String(month).padStart(2, "0")}:${invoiceCurrency}`;
      try {
        const [checkRow] = await sql`
          SELECT
            (SELECT COALESCE(SUM(amount), 0)
             FROM invoices
             WHERE property_id = ${propertyId}
               AND invoice_year = ${year}
               AND invoice_month = ${month}
               AND COALESCE(currency, 'UGX') = ${invoiceCurrency}
               AND status <> 'void'
               AND COALESCE(is_deleted, false) = false) AS live_total,
            (SELECT COALESCE(SUM(amount), 0)
             FROM transactions
             WHERE source_type = 'rent_accrual_summary'
               AND reference_number = ${accrualRef}
               AND COALESCE(is_deleted, false) = false) AS accrued
        `;
        const liveTotal = Number(checkRow?.live_total || 0);
        const accrued = Number(checkRow?.accrued || 0);
        if (Math.abs(liveTotal - accrued) > 0.01) {
          console.error(
            "reverse-invoice: accrual for the reversed month doesn't match its invoices",
            { invoiceId, accrualRef, liveTotal, accrued },
          );
          warnings.push(
            `Invoice reversed, but the rent accrual for ${year}-${String(month).padStart(2, "0")} (${accrued.toLocaleString()} ${invoiceCurrency}) doesn't match the month's live invoices (${liveTotal.toLocaleString()} ${invoiceCurrency}) — Due to Landlords and tenant receivables need review for that month.`,
          );
        }
      } catch (checkError) {
        console.error("reverse-invoice: accrual month check failed", {
          invoiceId,
          accrualRef,
          error: checkError,
        });
        warnings.push(
          "Invoice reversed, but the rent accrual for its month could not be checked.",
        );
      }
    }

    const resultAmount = Number(updated.amount);
    const resultPaid = Number(updated.paid_amount);
    const resultIsVoid = updated.status === "void";

    return Response.json({
      success: true,
      reversal_type: isFullReversal ? "full" : "partial",
      original_invoice_amount: originalInvoiceAmount,
      paid_amount: paidAmount,
      unpaid_balance_before_reversal: unpaidBalance,
      reversed_amount: amount,
      invoice_status: updated.status,
      remaining_unpaid_balance: resultIsVoid ? 0 : resultAmount - resultPaid,
      new_invoice_amount: resultIsVoid ? 0 : resultAmount,
      accrual_resync_warning: warnings.length ? warnings.join(" ") : null,
    });
  } catch (error) {
    console.error("POST /api/accounting/reverse-invoice error", error);
    return Response.json(
      { error: error.message || "Failed to reverse invoice" },
      { status: 500 },
    );
  }
}
