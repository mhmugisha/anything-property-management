import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoiceAccrualLedgerEntries } from "@/app/api/utils/invoices/invoiceAccrualLedger";

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

    const tenantId = toNumber(body?.tenant_id);
    const propertyIdFromBody = toNumber(body?.property_id);
    const arrearsDate = (body?.arrears_date || "").trim();
    const description = (body?.description || "").trim();
    const amount = toNumber(body?.amount);
    const currency = "UGX"; // Hardcoded to UGX only

    if (!tenantId || !arrearsDate || !amount) {
      return Response.json(
        {
          error: "tenant_id, arrears_date, and amount are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // Derive property/unit from tenant's active lease (used for reporting)
    const currentRows = await sql`
      SELECT
        p.id AS property_id,
        u.id AS unit_id,
        p.landlord_id AS landlord_id
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.tenant_id = ${tenantId}
        AND l.status = 'active'
      ORDER BY l.start_date DESC
      LIMIT 1
    `;

    const derivedPropertyId = currentRows?.[0]?.property_id || null;
    const derivedUnitId = currentRows?.[0]?.unit_id || null;
    const derivedLandlordId = currentRows?.[0]?.landlord_id || null;

    const propertyId = propertyIdFromBody || derivedPropertyId;
    const unitId = derivedUnitId;

    if (!propertyId) {
      return Response.json(
        {
          error:
            "Could not determine property. Ensure tenant has an active lease or specify property_id.",
        },
        { status: 400 },
      );
    }

    // Extract month/year from arrears_date for invoice grouping
    const dateObj = new Date(arrearsDate + "T00:00:00");
    const invoiceMonth = dateObj.getMonth() + 1;
    const invoiceYear = dateObj.getFullYear();

    // Build the invoice description
    const invoiceDescription = description
      ? `Arrears before lease date. - ${description}`
      : "Arrears before lease date.";

    // Insert the arrears invoice
    // lease_id is NULL because arrears are not tied to a specific lease
    // This invoice will be included in property-month summaries and management fee calculations
    const rows = await sql`
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
        NULL, ${tenantId}, ${propertyId}, ${unitId},
        ${arrearsDate}::date, ${arrearsDate}::date,
        ${invoiceMonth}, ${invoiceYear},
        ${invoiceDescription},
        ${amount}, ${currency},
        0, 0,
        0, 'open'
      )
      RETURNING *
    `;

    const invoice = rows?.[0] || null;

    // Trigger accounting sync: this will create the accrual entries
    // and include this arrears invoice in the property-month summary for management fee calculation
    try {
      await ensureInvoiceAccrualLedgerEntries({ force: true });
    } catch (e) {
      console.error("ensureInvoiceAccrualLedgerEntries failed for arrears", e);
      // Continue - the invoice is created, accounting can sync later
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.arrears.create",
      entityType: "invoice",
      entityId: invoice?.id || null,
      oldValues: null,
      newValues: invoice,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ invoice });
  } catch (error) {
    console.error("POST /api/accounting/post-arrears error", error);
    return Response.json(
      { error: "Failed to create arrears invoice" },
      { status: 500 },
    );
  }
}
