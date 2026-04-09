import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { ensureInvoicesForAllActiveLeasesUpToCurrentMonth } from "@/app/api/utils/invoices";

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function feeForMonth({ feeType, percent, fixedAmount, gross, currency }) {
  const t = String(feeType || "percent").toLowerCase();
  if (gross <= 0) return 0;
  if (t === "percent") {
    return round2((gross * Number(percent || 0)) / 100);
  }
  if (t === "fixed") {
    if (String(currency || "UGX") !== "UGX") return 0;
    return Math.min(Number(fixedAmount || 0), gross);
  }
  return 0;
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    await ensureInvoicesForAllActiveLeasesUpToCurrentMonth();

    const { searchParams } = new URL(request.url);
    const propertyId = Number(searchParams.get("propertyId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    if (!propertyId) {
      return Response.json(
        { error: "propertyId is required" },
        { status: 400 },
      );
    }

    const propertyRows = await sql`
      SELECT p.*, l.full_name AS landlord_name
      FROM properties p
      LEFT JOIN landlords l ON l.id = p.landlord_id
      WHERE p.id = ${propertyId}
      LIMIT 1
    `;

    const property = propertyRows?.[0] || null;
    if (!property) {
      return Response.json({ error: "Property not found" }, { status: 404 });
    }

    const where = [`i.property_id = $1`, `i.status <> 'void'`];
    const values = [propertyId];

    if (from) {
      where.push(`i.invoice_date >= $${values.length + 1}::date`);
      values.push(from);
    }

    if (to) {
      where.push(`i.invoice_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const invoiceQuery = `
      SELECT
        i.id,
        i.invoice_date,
        i.due_date,
        i.invoice_month,
        i.invoice_year,
        i.description,
        i.amount,
        i.paid_amount,
        (i.amount - i.paid_amount) AS outstanding,
        i.currency,
        t.full_name AS tenant_name,
        u.unit_number
      FROM invoices i
      LEFT JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN units u ON u.id = i.unit_id
      ${whereSql}
      ORDER BY i.invoice_year DESC, i.invoice_month DESC, i.id DESC
      LIMIT 2000
    `;

    const invoices = await sql(invoiceQuery, values);

    // Management fees are computed once per property-month-currency.
    const feeType = String(
      property?.management_fee_type || "percent",
    ).toLowerCase();
    const percent = Number(property?.management_fee_percent || 0);
    const fixedAmount = Number(property?.management_fee_fixed_amount || 0);

    const groups = new Map();
    for (const inv of invoices || []) {
      const currency = String(inv.currency || "UGX");
      const key = `${inv.invoice_year}-${inv.invoice_month}-${currency}`;
      const prev = groups.get(key) || [];
      prev.push(inv);
      groups.set(key, prev);
    }

    let managementFeesTotal = 0;
    for (const rows of groups.values()) {
      const sample = rows?.[0] || {};
      const gross = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const feeTotal = feeForMonth({
        feeType,
        percent,
        fixedAmount,
        gross,
        currency: sample.currency,
      });
      managementFeesTotal += Number(feeTotal || 0);
    }

    const paymentsWhere = [`i.property_id = $1`, `pay.is_reversed = false`];
    const paymentsValues = [propertyId];

    if (from) {
      paymentsWhere.push(
        `pay.payment_date >= $${paymentsValues.length + 1}::date`,
      );
      paymentsValues.push(from);
    }

    if (to) {
      paymentsWhere.push(
        `pay.payment_date <= $${paymentsValues.length + 1}::date`,
      );
      paymentsValues.push(to);
    }

    const paymentsQuery = `
      SELECT
        pay.id,
        pay.payment_date,
        pay.payment_method,
        pay.reference_number,
        pia.amount_applied,
        i.id AS invoice_id,
        i.description AS invoice_description,
        t.full_name AS tenant_name,
        u.unit_number
      FROM payment_invoice_allocations pia
      JOIN payments pay ON pay.id = pia.payment_id
      JOIN invoices i ON i.id = pia.invoice_id
      LEFT JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE ${paymentsWhere.join(" AND ")}
      ORDER BY pay.payment_date DESC, pay.id DESC
      LIMIT 2000
    `;

    const payments = await sql(paymentsQuery, paymentsValues);

    const grossRent = (invoices || []).reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0,
    );

    const outstanding = (invoices || []).reduce(
      (sum, inv) => sum + Number(inv.outstanding || 0),
      0,
    );

    const netDue = grossRent - managementFeesTotal;

    return Response.json({
      property,
      filters: { from: from || null, to: to || null },
      invoices,
      payments,
      totals: {
        gross_rent: grossRent,
        management_fees: managementFeesTotal,
        outstanding,
        net_due: netDue,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/property-statement error", error);
    return Response.json(
      { error: "Failed to build property statement" },
      { status: 500 },
    );
  }
}
