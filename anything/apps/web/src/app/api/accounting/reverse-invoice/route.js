import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";

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
    let propertyId = toNumber(body?.property_id);
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

    // Fetch invoice details including paid_amount to calculate unpaid balance
    const invoiceRows = await sql`
      SELECT i.tenant_id, i.property_id, i.amount, i.currency, i.description, i.paid_amount, i.status
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
    propertyId = propertyId || toNumber(invoice.property_id);
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

    // Create ONLY ONE accounting entry: Reverse the rent accrual (no management fee reversal)
    // Original invoice created: Debit 1210 (Rent Receivable), Credit 2100 (Due to Landlords)
    // Reversal entry: Debit 2100 (Due to Landlords), Credit 1210 (Rent Receivable)
    const rentReversalPost = await postAccountingEntryFromIntents({
      transactionDate: reversalDate,
      description: `${description} - ${invoice.description}`,
      referenceNumber: null,
      debitIntent: "landlord_liability",
      creditIntent: "tenant_receivable",
      amount,
      currency,
      createdBy: perm.staff.id,
      propertyId: propertyId,
      sourceType: "rent_reversal",
      sourceId: invoiceId,
      auditContext: {
        sourceModule: "accounting",
        businessEvent: "RENT_INVOICE_REVERSED",
        sourceEntity: {
          type: "rent_reversal",
          invoice_id: invoiceId,
          tenant_id: tenantId,
          property_id: propertyId,
        },
      },
    });

    if (!rentReversalPost.ok) {
      throw new Error(
        `Rent reversal failed: ${rentReversalPost.error || "unknown error"}`,
      );
    }

    // Update the invoice record based on reversal type
    const remainingUnpaidBalance = unpaidBalance - amount;
    const isFullReversal = remainingUnpaidBalance <= 0.01; // Floating point tolerance

    if (isFullReversal) {
      // Full reversal of unpaid balance: Mark invoice as void
      await sql`
        UPDATE invoices
        SET status = 'void'
        WHERE id = ${invoiceId}
      `;
    } else {
      // Partial reversal: Reduce invoice amount by reversed amount
      const newInvoiceAmount = originalInvoiceAmount - amount;
      await sql`
        UPDATE invoices
        SET amount = ${newInvoiceAmount}
        WHERE id = ${invoiceId}
      `;
    }

    return Response.json({
      success: true,
      reversal_type: isFullReversal ? "full" : "partial",
      original_invoice_amount: originalInvoiceAmount,
      paid_amount: paidAmount,
      unpaid_balance_before_reversal: unpaidBalance,
      reversed_amount: amount,
      remaining_unpaid_balance: isFullReversal ? 0 : remainingUnpaidBalance,
      new_invoice_amount: isFullReversal ? 0 : originalInvoiceAmount - amount,
      transaction_id: rentReversalPost.transaction?.id || null,
    });
  } catch (error) {
    console.error("POST /api/accounting/reverse-invoice error", error);
    return Response.json(
      { error: error.message || "Failed to reverse invoice" },
      { status: 500 },
    );
  }
}
