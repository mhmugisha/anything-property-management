import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";
import { autoApplyAdvancePaymentsForTenant } from "@/app/api/utils/payments/autoApply";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";
import { createArrearsRecoveryFee } from "@/app/api/utils/payments/arrearsFeesHandler";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function GET(request) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const propertyId = toNumber(searchParams.get("propertyId"));
    const tenantId = toNumber(searchParams.get("tenantId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const where = ["p.is_reversed = false"];
    const values = [];

    if (propertyId) {
      where.push(`p.property_id = $${values.length + 1}`);
      values.push(propertyId);
    }

    if (tenantId) {
      where.push(`p.tenant_id = $${values.length + 1}`);
      values.push(tenantId);
    }

    if (from) {
      where.push(`p.payment_date >= $${values.length + 1}::date`);
      values.push(from);
    }

    if (to) {
      where.push(`p.payment_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    if (search) {
      where.push(
        `(LOWER(COALESCE(t.full_name,'')) LIKE LOWER($${values.length + 1}) OR LOWER(COALESCE(pr.property_name,'')) LIKE LOWER($${values.length + 1}) OR COALESCE(p.reference_number,'') LIKE $${values.length + 1})`,
      );
      values.push(`%${search}%`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    // FIX: Aggregate invoice allocations to prevent duplicate payment rows
    const query = `
      SELECT
        p.*, 
        t.full_name AS tenant_name,
        pr.property_name,
        COALESCE(
          json_agg(
            json_build_object(
              'invoice_id', i.id,
              'description', i.description,
              'amount_applied', pia.amount_applied
            )
            ORDER BY i.invoice_date
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS invoice_allocations
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN properties pr ON p.property_id = pr.id
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      LEFT JOIN invoices i ON i.id = pia.invoice_id
      ${whereSql}
      GROUP BY p.id, t.full_name, pr.property_name
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT 200
    `;

    const payments = await sql(query, values);
    return Response.json({ payments });
  } catch (error) {
    console.error("GET /api/payments error", error);
    return Response.json(
      { error: "Failed to fetch payments" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const invoiceId = toNumber(body?.invoice_id);
    const tenantId = toNumber(body?.tenant_id);
    const propertyId = toNumber(body?.property_id);

    const paymentDate = (body?.payment_date || "").trim();
    const amount = toNumber(body?.amount);
    const paymentMethod = (body?.payment_method || "").trim();
    const referenceNumber = (body?.reference_number || "").trim() || null;
    const notes = (body?.notes || "").trim() || null;
    const description = (body?.description || "").trim() || null;

    if (!paymentDate || !amount || !paymentMethod) {
      return Response.json(
        { error: "payment_date, amount, and payment_method are required" },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // =============================
    // CASE A: Pay a specific invoice
    // =============================
    if (invoiceId) {
      // Lock invoice row (basic protection against double-pay)
      const invoiceRows = await sql`
        SELECT
          i.*, 
          (i.amount - i.paid_amount) AS outstanding,
          t.full_name AS tenant_name,
          p.property_name,
          p.landlord_id
        FROM invoices i
        LEFT JOIN tenants t ON t.id = i.tenant_id
        LEFT JOIN properties p ON p.id = i.property_id
        WHERE i.id = ${invoiceId}
        LIMIT 1
      `;

      const invoice = invoiceRows?.[0] || null;

      if (!invoice) {
        return Response.json({ error: "Invoice not found" }, { status: 404 });
      }

      // ENHANCEMENT: Duplicate Payment Protection
      if (invoice.status === "paid") {
        return Response.json(
          { error: "This invoice is already fully paid" },
          { status: 400 },
        );
      }

      const outstanding = Number(invoice.outstanding || 0);

      // ENHANCEMENT: Prevent overpayment on specific invoice
      if (amount > outstanding) {
        return Response.json(
          {
            error:
              "Payment is larger than the invoice outstanding. Use a smaller amount or record a separate overpayment flow.",
          },
          { status: 400 },
        );
      }

      // Create payment
      const approvalA = getApprovalFields(perm.staff);
      const paymentRows = await sql`
        INSERT INTO payments (
          lease_id, tenant_id, property_id,
          payment_date, amount, currency, payment_method,
          reference_number,
          recorded_by, notes,
          period_month, period_year,
          description,
          approval_status, approved_by, approved_at
        )
        VALUES (
          ${invoice.lease_id}, ${invoice.tenant_id}, ${invoice.property_id},
          ${paymentDate}::date, ${amount}, ${invoice.currency || "UGX"}, ${paymentMethod},
          ${referenceNumber},
          ${perm.staff.id}, ${notes},
          NULL, NULL,
          ${description || invoice.description || null},
          ${approvalA.approval_status}, ${approvalA.approved_by}, ${approvalA.approved_at}
        )
        RETURNING *
      `;

      const payment = paymentRows?.[0] || null;

      // Allocate payment to invoice
      await sql`
        INSERT INTO payment_invoice_allocations (payment_id, invoice_id, amount_applied)
        VALUES (${payment.id}, ${invoiceId}, ${amount})
      `;

      // Update invoice paid + status
      const updatedRows = await sql`
        UPDATE invoices
        SET paid_amount = paid_amount + ${amount},
            status = CASE
              WHEN (paid_amount + ${amount}) >= amount THEN 'paid'
              ELSE 'open'
            END
        WHERE id = ${invoiceId}
        RETURNING *
      `;

      const updatedInvoice = updatedRows?.[0] || null;

      // Post accounting via CIL:
      // Receipt: Dr Undeposited Funds, Cr Rent Receivable
      const receiptDesc = `Rent Collection - ${invoice.tenant_name || "Tenant"} - ${invoice.description}`;

      const post = await postAccountingEntryFromIntents({
        transactionDate: paymentDate,
        description: receiptDesc,
        referenceNumber: referenceNumber,
        debitIntent: "undeposited_funds",
        creditIntent: "tenant_receivable",
        amount: amount,
        currency: invoice.currency || "UGX",
        createdBy: perm.staff.id,
        landlordId: invoice.landlord_id || null,
        propertyId: invoice.property_id,
        sourceType: "payment",
        sourceId: payment.id,
        approvalStatus: getApprovalStatus(perm.staff),
        auditContext: {
          sourceModule: "property",
          businessEvent: "TENANT_PAYMENT_RECEIVED",
          sourceEntity: { type: "payment", id: payment.id },
        },
      });

      if (!post.ok) {
        throw new Error(
          `Accounting posting failed: ${post.error || "unknown error"}`,
        );
      }

      // NEW: Check if this is an arrears invoice and create fee deduction if needed
      try {
        const feeResult = await createArrearsRecoveryFee({
          invoiceId,
          amountPaid: amount,
          paymentDate,
          staffId: perm.staff.id,
        });

        if (!feeResult.ok) {
          console.error(
            "Failed to create arrears recovery fee:",
            feeResult.error,
          );
          // Don't fail the payment - just log the error
        } else if (feeResult.deduction) {
          console.log(
            `Created arrears recovery fee deduction ${feeResult.deduction.id} for ${feeResult.deduction.amount} UGX`,
          );
        }
      } catch (feeError) {
        console.error("Error creating arrears recovery fee:", feeError);
        // Don't fail the payment
      }

      await writeAuditLog({
        staffId: perm.staff.id,
        action: "payment.create",
        entityType: "payment",
        entityId: payment?.id || null,
        oldValues: null,
        newValues: payment,
        ipAddress: perm.ipAddress,
      });

      await writeAuditLog({
        staffId: perm.staff.id,
        action: "invoice.payment.apply",
        entityType: "invoice",
        entityId: invoiceId,
        oldValues: invoice,
        newValues: updatedInvoice,
        ipAddress: perm.ipAddress,
      });

      // 🔔 Notify admins about invoice payment
      notifyAllAdminsAsync({
        title: "New Payment Received",
        message: `New payment of ${invoice.currency || "UGX"} ${Number(amount).toLocaleString()} received from ${invoice.tenant_name || "Tenant"} for ${invoice.description}. Recorded by ${perm.staff.full_name || "Staff"}`,
        type: "payment",
        reference_id: payment.id,
        reference_type: "payment",
      });

      return Response.json({ payment, invoice: updatedInvoice });
    }

    // =========================================
    // CASE B: Advance payment (no invoice yet)
    // =========================================

    if (!tenantId || !propertyId) {
      return Response.json(
        {
          error:
            "tenant_id and property_id are required when invoice_id is not provided",
        },
        { status: 400 },
      );
    }

    // Find the active lease for this tenant in this property
    const leaseRows = await sql`
      SELECT
        l.id AS lease_id,
        l.currency,
        t.full_name AS tenant_name,
        p.property_name,
        p.landlord_id
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.status = 'active'
        AND l.tenant_id = ${tenantId}
        AND p.id = ${propertyId}
      ORDER BY l.start_date DESC, l.id DESC
      LIMIT 1
    `;

    const lease = leaseRows?.[0] || null;

    if (!lease) {
      return Response.json(
        {
          error:
            "No active lease found for this tenant in the selected property",
        },
        { status: 400 },
      );
    }

    const advDesc = description || "Payment on Account";

    const approvalB = getApprovalFields(perm.staff);
    const paymentRows = await sql`
      INSERT INTO payments (
        lease_id, tenant_id, property_id,
        payment_date, amount, currency, payment_method,
        reference_number,
        recorded_by, notes,
        period_month, period_year,
        description,
        approval_status, approved_by, approved_at
      )
      VALUES (
        ${lease.lease_id}, ${tenantId}, ${propertyId},
        ${paymentDate}::date, ${amount}, ${lease.currency || "UGX"}, ${paymentMethod},
        ${referenceNumber},
        ${perm.staff.id}, ${notes},
        NULL, NULL,
        ${advDesc},
        ${approvalB.approval_status}, ${approvalB.approved_by}, ${approvalB.approved_at}
      )
      RETURNING *
    `;

    const payment = paymentRows?.[0] || null;

    // Post accounting entry for advance payment
    // Dr Undeposited Funds (Asset - cash received)
    // Cr Tenant Prepayments (Liability - obligation to provide future rent)
    const prepaymentDesc = `Payment on Account - ${lease.tenant_name || "Tenant"} - ${lease.property_name}`;

    const post = await postAccountingEntryFromIntents({
      transactionDate: paymentDate,
      description: prepaymentDesc,
      referenceNumber: referenceNumber,
      debitIntent: "undeposited_funds",
      creditIntent: "tenant_prepayments",
      amount: amount,
      currency: lease.currency || "UGX",
      createdBy: perm.staff.id,
      landlordId: lease.landlord_id || null,
      propertyId: propertyId,
      sourceType: "payment_advance",
      sourceId: payment.id,
      approvalStatus: getApprovalStatus(perm.staff),
      auditContext: {
        sourceModule: "property",
        businessEvent: "TENANT_ADVANCE_PAYMENT_RECEIVED",
        sourceEntity: { type: "payment", id: payment.id },
      },
    });

    if (!post.ok) {
      throw new Error(
        `Accounting posting failed for advance payment: ${post.error || "unknown error"}`,
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "payment.create",
      entityType: "payment",
      entityId: payment?.id || null,
      oldValues: null,
      newValues: payment,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about advance payment
    notifyAllAdminsAsync({
      title: "Payment on Account Received",
      message: `New payment on account of ${lease.currency || "UGX"} ${Number(amount).toLocaleString()} received from ${lease.tenant_name || "Tenant"} at ${lease.property_name}. Recorded by ${perm.staff.full_name || "Staff"}`,
      type: "payment",
      reference_id: payment.id,
      reference_type: "payment",
    });

    // ENHANCEMENT: Immediately auto-apply advance payment to outstanding invoices
    let autoApplyResult = null;
    try {
      autoApplyResult = await autoApplyAdvancePaymentsForTenant(tenantId);
      if (!autoApplyResult.ok) {
        console.error("Auto-apply failed:", autoApplyResult.error);
      }
    } catch (e) {
      console.error("Error during auto-apply:", e);
      // Don't fail the payment creation if auto-apply fails
    }

    return Response.json({
      payment,
      invoice: null,
      advance: true,
      autoApplied: autoApplyResult?.ok
        ? {
            count: autoApplyResult.appliedCount || 0,
            amount: autoApplyResult.appliedAmount || 0,
          }
        : null,
    });
  } catch (error) {
    console.error("POST /api/payments error", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);

    // Return the actual error message for debugging
    const errorMessage = error.message || "Failed to record payment";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
