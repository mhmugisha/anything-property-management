import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { ensureInvoiceAccrualLedgerEntries } from "@/app/api/utils/invoices/invoiceAccrualLedger";

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

    // Fetch invoice details + property management fee config in one query
    const invoiceRows = await sql`
      SELECT
        i.tenant_id, i.property_id, i.lease_id,
        i.amount, i.currency, i.description, i.paid_amount, i.status,
        p.landlord_id,
        COALESCE(p.management_fee_type, 'percent')::text AS management_fee_type,
        COALESCE(p.management_fee_percent, 0)::numeric AS management_fee_percent,
        COALESCE(p.management_fee_fixed_amount, 0)::numeric AS management_fee_fixed_amount
      FROM invoices i
      LEFT JOIN properties p ON p.id = i.property_id
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

    // Reverse the rent accrual half of the original invoice entry.
    // Original rent_accrual_summary: Dr 1210 (Rent Receivable) / Cr 2100 (Due to Landlords)
    // Reversal:                      Dr 2100 (Due to Landlords) / Cr 1210 (Rent Receivable)
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

    // GAP 1: Reverse the management fee proportionally.
    // Original mgmt_fee_summary: Dr 2100 (Due to Landlords) / Cr 4100 (Management Fee Income)
    // Reversal:                  Dr 4100 (Management Fee Income) / Cr 2100 (Due to Landlords)
    let mgmtFeeReversed = null;
    try {
      const feeType = invoice.management_fee_type;
      const feePercent = Number(invoice.management_fee_percent || 0);
      const feeFixed = Number(invoice.management_fee_fixed_amount || 0);

      let feeAmount = 0;
      if (feeType === "percent" && feePercent > 0) {
        feeAmount = amount * (feePercent / 100);
      } else if (feeType === "fixed" && feeFixed > 0 && originalInvoiceAmount > 0) {
        // Proportional share of the fixed fee for the reversed portion
        feeAmount = amount * (feeFixed / originalInvoiceAmount);
      }

      feeAmount = Math.round(feeAmount * 100) / 100;

      if (feeAmount > 0) {
        const mgmtFeePost = await postAccountingEntryFromIntents({
          transactionDate: reversalDate,
          description: `Management fee reversal - ${invoice.description}`,
          referenceNumber: null,
          debitIntent: "management_fee_income",
          creditIntent: "landlord_liability",
          amount: feeAmount,
          currency,
          createdBy: perm.staff.id,
          landlordId: toNumber(invoice.landlord_id),
          propertyId: propertyId,
          sourceType: "mgmt_fee_reversal",
          sourceId: invoiceId,
          auditContext: {
            sourceModule: "accounting",
            businessEvent: "MGMT_FEE_REVERSED",
            sourceEntity: {
              type: "mgmt_fee_reversal",
              invoice_id: invoiceId,
              tenant_id: tenantId,
              property_id: propertyId,
            },
          },
        });

        if (mgmtFeePost.ok) {
          mgmtFeeReversed = feeAmount;
        } else {
          console.error("Management fee reversal GL post failed:", mgmtFeePost.error);
        }
      }
    } catch (feeErr) {
      console.error("Error posting management fee reversal:", feeErr);
      // Non-fatal — rent reversal already succeeded
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

    // GAP 2: Re-sync the property-month accrual summary so the aggregate GL row
    // reflects the updated (or voided) invoice amount.
    let accrualSynced = false;
    try {
      const leaseId = toNumber(invoice.lease_id);
      if (leaseId) {
        await ensureInvoiceAccrualLedgerEntries({ force: true, leaseId });
        accrualSynced = true;
      }
    } catch (syncErr) {
      console.error("Accrual sync after invoice reversal failed:", syncErr);
      // Non-fatal — reversal already succeeded
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
      mgmt_fee_reversed: mgmtFeeReversed,
      accrual_synced: accrualSynced,
    });
  } catch (error) {
    console.error("POST /api/accounting/reverse-invoice error", error);
    return Response.json(
      { error: error.message || "Failed to reverse invoice" },
      { status: 500 },
    );
  }
}
