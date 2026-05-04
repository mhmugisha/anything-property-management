import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { ensureInvoicesForAllActiveLeasesUpToCurrentMonth } from "@/app/api/utils/invoices";

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function feeForPropertyMonth({
  feeType,
  percent,
  fixedAmount,
  gross,
  currency,
}) {
  const t = String(feeType || "percent").toLowerCase();
  if (gross <= 0) return 0;

  if (t === "percent") {
    const p = Number(percent || 0);
    return round2((gross * p) / 100);
  }

  if (t === "fixed") {
    // Fixed amounts are UGX-only in this app.
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
    const monthParam = Number(searchParams.get("month"));
    const yearParam = Number(searchParams.get("year"));

    const now = new Date();
    const month = monthParam || now.getMonth() + 1;
    const year = yearParam || now.getFullYear();

    const invoiceLines = await sql`
      SELECT
        l.id AS landlord_id,
        l.full_name AS landlord_name,
        l.phone AS landlord_phone,
        l.email AS landlord_email,
        p.id AS property_id,
        p.property_name,
        p.management_fee_type,
        p.management_fee_percent,
        p.management_fee_fixed_amount,
        t.id AS tenant_id,
        t.full_name AS tenant_name,
        u.unit_number,
        i.id AS invoice_id,
        i.description,
        i.amount,
        i.paid_amount,
        (i.amount - i.paid_amount) AS outstanding,
        COALESCE(i.currency,'UGX') AS currency
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      LEFT JOIN landlords l ON l.id = p.landlord_id
      LEFT JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE i.invoice_month = ${month}
        AND i.invoice_year = ${year}
        AND i.status <> 'void'
        AND COALESCE(i.approval_status, 'approved') = 'approved'
      ORDER BY l.full_name, p.property_name, t.full_name
    `;

    // Compute management fee ONCE per property (for this month/year).
    const grossByProperty = new Map();
    const sampleByProperty = new Map();

    for (const r of invoiceLines || []) {
      const propKey = String(r.property_id || "");
      if (!propKey) continue;

      const prev = Number(grossByProperty.get(propKey) || 0);
      grossByProperty.set(propKey, prev + Number(r.amount || 0));

      if (!sampleByProperty.has(propKey)) {
        sampleByProperty.set(propKey, r);
      }
    }

    const mgmtFeeByProperty = new Map();
    for (const [propKey, gross] of grossByProperty.entries()) {
      const sample = sampleByProperty.get(propKey) || {};
      const feeTotal = feeForPropertyMonth({
        feeType: sample.management_fee_type,
        percent: sample.management_fee_percent,
        fixedAmount: sample.management_fee_fixed_amount,
        gross: Number(gross || 0),
        currency: sample.currency,
      });
      mgmtFeeByProperty.set(propKey, Number(feeTotal || 0));
    }

    const deductions = await sql`
      SELECT
        d.*,
        l.full_name AS landlord_name,
        p.property_name
      FROM landlord_deductions d
      LEFT JOIN landlords l ON l.id = d.landlord_id
      LEFT JOIN properties p ON p.id = d.property_id
      WHERE EXTRACT(MONTH FROM d.deduction_date)::int = ${month}
        AND EXTRACT(YEAR FROM d.deduction_date)::int = ${year}
      ORDER BY l.full_name, d.deduction_date DESC
    `;

    const byLandlord = new Map();

    for (const row of invoiceLines) {
      const lid = row.landlord_id || 0;
      if (!byLandlord.has(lid)) {
        byLandlord.set(lid, {
          landlord_id: row.landlord_id,
          landlord_name: row.landlord_name || "Unassigned",
          landlord_phone: row.landlord_phone || null,
          landlord_email: row.landlord_email || null,
          month,
          year,
          lines: [],
          property_summaries: [],
          totals: {
            gross_rent: 0,
            management_fees: 0,
            deductions: 0,
            net_due: 0,
          },
        });
      }

      const entry = byLandlord.get(lid);

      const item = {
        property_id: row.property_id,
        property_name: row.property_name,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        unit_number: row.unit_number,
        invoice_id: row.invoice_id,
        description: row.description,
        rent_amount: Number(row.amount || 0),
      };

      entry.lines.push(item);
      entry.totals.gross_rent += item.rent_amount;
    }

    // Add property-level fee totals per landlord.
    for (const entry of byLandlord.values()) {
      const propIds = new Set(
        (entry.lines || []).map((l) => String(l.property_id || "")),
      );

      let fees = 0;
      const summaries = [];

      for (const propKey of propIds) {
        if (!propKey) continue;
        const propGross = Number(grossByProperty.get(propKey) || 0);
        const propFee = Number(mgmtFeeByProperty.get(propKey) || 0);
        fees += propFee;

        const sample = sampleByProperty.get(propKey) || {};
        summaries.push({
          property_id: Number(propKey),
          property_name: sample.property_name || "Property",
          gross_rent: propGross,
          management_fees: propFee,
          net_due: propGross - propFee,
        });
      }

      summaries.sort((a, b) =>
        String(a.property_name || "").localeCompare(
          String(b.property_name || ""),
        ),
      );

      entry.property_summaries = summaries;
      entry.totals.management_fees = fees;
      entry.totals.net_due = entry.totals.gross_rent - fees;
    }

    // Apply deductions
    for (const d of deductions) {
      const lid = d.landlord_id || 0;
      if (!byLandlord.has(lid)) {
        byLandlord.set(lid, {
          landlord_id: d.landlord_id,
          landlord_name: d.landlord_name || "Unassigned",
          landlord_phone: null,
          landlord_email: null,
          month,
          year,
          lines: [],
          property_summaries: [],
          totals: {
            gross_rent: 0,
            management_fees: 0,
            deductions: 0,
            net_due: 0,
          },
        });
      }
      const entry = byLandlord.get(lid);
      entry.totals.deductions += Number(d.amount || 0);
      entry.totals.net_due -= Number(d.amount || 0);
    }

    const landlords = Array.from(byLandlord.values()).sort((a, b) =>
      String(a.landlord_name || "").localeCompare(
        String(b.landlord_name || ""),
      ),
    );

    const summaryTotals = landlords.reduce(
      (acc, l) => {
        acc.gross_rent += l.totals.gross_rent;
        acc.management_fees += l.totals.management_fees;
        acc.deductions += l.totals.deductions;
        acc.net_due += l.totals.net_due;
        return acc;
      },
      { gross_rent: 0, management_fees: 0, deductions: 0, net_due: 0 },
    );

    return Response.json({ month, year, landlords, totals: summaryTotals });
  } catch (error) {
    console.error("GET /api/reports/landlord-summary error", error);
    return Response.json(
      { error: "Failed to build landlord summary" },
      { status: 500 },
    );
  }
}
