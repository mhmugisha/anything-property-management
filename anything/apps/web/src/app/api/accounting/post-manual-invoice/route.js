import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoiceAccrualLedgerEntries } from "@/app/api/utils/invoices/invoiceAccrualLedger";
import { autoApplyAdvancePaymentsToOpenInvoices } from "@/app/api/utils/payments/autoApply";

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

    const leaseId = toNumber(body?.lease_id);
    const invoiceDate = (body?.invoice_date || "").trim();
    const description = (body?.description || "").trim();
    const amount = toNumber(body?.amount);

    if (!leaseId || !invoiceDate || !description || !amount) {
      return Response.json(
        {
          error: "lease_id, invoice_date, description, and amount are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // Get lease details
    const leaseRows = await sql`
      SELECT
        l.id,
        l.unit_id,
        l.tenant_id,
        l.status,
        l.currency,
        u.property_id,
        p.landlord_id,
        t.full_name AS tenant_name
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      LEFT JOIN tenants t ON t.id = l.tenant_id
      WHERE l.id = ${leaseId}
    `;

    if (!leaseRows || leaseRows.length === 0) {
      return Response.json({ error: "Lease not found" }, { status: 404 });
    }

    const lease = leaseRows[0];

    if (lease.status !== "active") {
      return Response.json(
        { error: "Lease must be active to post manual invoice" },
        { status: 400 },
      );
    }

    // Validate tenant_id exists (required for statement inclusion)
    if (!lease.tenant_id) {
      return Response.json(
        {
          error: "Lease must have a tenant assigned to create a manual invoice",
        },
        { status: 400 },
      );
    }

    const tenantId = lease.tenant_id;
    const propertyId = lease.property_id;
    const unitId = lease.unit_id;
    const currency = lease.currency || "UGX";

    // Extract month/year from invoice_date for invoice grouping
    const dateObj = new Date(invoiceDate + "T00:00:00");
    const invoiceMonth = dateObj.getMonth() + 1;
    const invoiceYear = dateObj.getFullYear();

    // Use the user-provided description (now required)
    const invoiceDescription = description;

    // Insert the manual invoice
    // lease_id is populated (unlike arrears) - this is tied to a specific lease
    // This invoice will be included in property-month summaries and management fee calculations
    let rows;
    try {
      rows = await sql`
        INSERT INTO invoices (
          lease_id, tenant_id, property_id, unit_id,
          invoice_date, due_date,
          invoice_month, invoice_year,
          description,
          amount, currency,
          commission_rate, commission_amount,
          paid_amount, status
        )
        VALUES (
          ${leaseId}, ${tenantId}, ${propertyId}, ${unitId},
          ${invoiceDate}::date, ${invoiceDate}::date,
          ${invoiceMonth}, ${invoiceYear},
          ${invoiceDescription},
          ${amount}, ${currency},
          0, 0,
          0, 'open'
        )
        RETURNING *
      `;
    } catch (insertErr) {
      console.error("INSERT invoice failed:", insertErr);
      // Check for unique constraint violation
      const errMsg = String(insertErr?.message || "");
      if (
        errMsg.includes("unique") ||
        errMsg.includes("duplicate") ||
        errMsg.includes("23505")
      ) {
        return Response.json(
          {
            error: `A rent invoice already exists for this lease in ${invoiceYear}-${String(invoiceMonth).padStart(2, "0")}. Please use a different date or description.`,
          },
          { status: 409 },
        );
      }
      throw insertErr;
    }

    const invoice = rows?.[0] || null;

    // Trigger accounting sync: this will create the accrual entries
    // Dr 1210 (Rent Receivable), Cr 4200 (Rent Revenue)
    // and include this invoice in the property-month summary for management fee calculation
    try {
      await ensureInvoiceAccrualLedgerEntries({ force: true });
    } catch (e) {
      console.error(
        "ensureInvoiceAccrualLedgerEntries failed for manual invoice",
        e,
      );
      // Continue - the invoice is created, accounting can sync later
    }

    // Auto-apply any prepayments for this tenant
    try {
      await autoApplyAdvancePaymentsToOpenInvoices({ tenantId });
    } catch (e) {
      console.error("autoApplyAdvancePaymentsToOpenInvoices failed", e);
      // Continue - auto-apply can run later
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.manual_invoice.create",
      entityType: "invoice",
      entityId: invoice?.id || null,
      oldValues: null,
      newValues: invoice,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ invoice });
  } catch (error) {
    console.error("POST /api/accounting/post-manual-invoice error", error);
    return Response.json(
      { error: "Failed to create manual invoice" },
      { status: 500 },
    );
  }
}
