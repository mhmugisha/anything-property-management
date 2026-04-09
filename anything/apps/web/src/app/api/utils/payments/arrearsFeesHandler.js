import sql from "@/app/api/utils/sql";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";

/**
 * Creates a landlord deduction for management fees on recovered arrears.
 *
 * This function should be called after a payment is allocated to an arrears invoice.
 * It checks if the invoice is an arrears invoice (lease_id IS NULL) and if the
 * property uses percentage-based management fees. If so, it creates a deduction
 * for the fee on the recovered arrears amount.
 *
 * @param {Object} params
 * @param {number} params.invoiceId - The ID of the invoice that was paid
 * @param {number} params.amountPaid - The amount that was paid on this invoice
 * @param {string} params.paymentDate - The payment date (ISO format)
 * @param {number|null} params.staffId - The staff user who recorded the payment (can be null for auto-apply)
 * @returns {Promise<{ok: boolean, deduction?: Object, error?: string}>}
 */
export async function createArrearsRecoveryFee({
  invoiceId,
  amountPaid,
  paymentDate,
  staffId = null,
}) {
  try {
    // 1. Get invoice details and property management fee settings
    const invoiceRows = await sql`
      SELECT 
        i.id,
        i.lease_id,
        i.invoice_month,
        i.invoice_year,
        i.property_id,
        i.tenant_id,
        p.landlord_id,
        p.management_fee_type,
        p.management_fee_percent,
        p.management_fee_fixed_amount
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      WHERE i.id = ${invoiceId}
      LIMIT 1
    `;

    const invoice = invoiceRows?.[0] || null;
    if (!invoice) {
      return { ok: false, error: "Invoice not found" };
    }

    // 2. Check if this is an arrears invoice (lease_id IS NULL)
    if (invoice.lease_id !== null) {
      // Not an arrears invoice, no fee deduction needed
      return { ok: true, deduction: null };
    }

    // 3. Check if management fee type is "percent"
    const feeType = String(
      invoice.management_fee_type || "percent",
    ).toLowerCase();
    if (feeType !== "percent") {
      // Fixed fee properties don't charge on arrears recovery
      return { ok: true, deduction: null };
    }

    // 4. Calculate the fee on the recovered arrears amount
    const feePercent = Number(invoice.management_fee_percent || 0);
    if (feePercent <= 0) {
      // No fee to charge
      return { ok: true, deduction: null };
    }

    const feeAmount =
      Math.round(((Number(amountPaid) * feePercent) / 100) * 100) / 100;
    if (feeAmount <= 0) {
      return { ok: true, deduction: null };
    }

    // 5. Format month label for description
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthName = months[(invoice.invoice_month || 1) - 1] || "";
    const description = `Fees on recovered arrears - ${monthName} ${invoice.invoice_year}`;

    // 6. Create the landlord deduction
    const deductionRows = await sql`
      INSERT INTO landlord_deductions (
        landlord_id, property_id, deduction_date,
        description, amount, created_by,
        is_deleted
      )
      VALUES (
        ${invoice.landlord_id}, ${invoice.property_id}, ${paymentDate}::date,
        ${description}, ${feeAmount}, ${staffId},
        false
      )
      RETURNING *
    `;

    const deduction = deductionRows?.[0] || null;
    if (!deduction) {
      return { ok: false, error: "Failed to create deduction record" };
    }

    // 7. Post accounting entry: Dr Due to Landlords (reduce liability), Cr Revenue - Management Fees
    const txDesc = `Management fees on recovered arrears - ${monthName} ${invoice.invoice_year}`;

    const post = await postAccountingEntryFromIntents({
      transactionDate: paymentDate,
      description: txDesc,
      referenceNumber: null,
      debitIntent: "landlord_liability",
      creditIntent: "management_fee_income",
      amount: feeAmount,
      currency: "UGX",
      createdBy: staffId,
      landlordId: invoice.landlord_id,
      propertyId: invoice.property_id,
      expenseScope: "landlord",
      sourceType: "landlord_deduction",
      sourceId: deduction.id,
      auditContext: {
        sourceModule: "payments",
        businessEvent: "ARREARS_RECOVERY_FEE",
        sourceEntity: {
          type: "landlord_deduction",
          id: deduction.id,
          invoiceId: invoice.id,
        },
      },
    });

    if (!post.ok) {
      console.error(
        `Failed to post accounting entry for arrears fee deduction ${deduction.id}:`,
        post.error,
      );
      // Don't fail the whole operation if accounting posting fails
      return {
        ok: true,
        deduction,
        accountingError: post.error,
      };
    }

    return { ok: true, deduction, transaction: post.transaction };
  } catch (error) {
    console.error("createArrearsRecoveryFee error:", error);
    return {
      ok: false,
      error: error.message || "Failed to create arrears recovery fee",
    };
  }
}
