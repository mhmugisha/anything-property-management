import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function sumByCurrency(rows, field) {
  const map = new Map();
  for (const r of rows || []) {
    const currency = String(r.currency || "UGX");
    const amt = Number(r?.[field] || 0);
    const prev = map.get(currency) || 0;
    map.set(currency, prev + amt);
  }
  return map;
}

// Helper to get month name from number
function getMonthName(monthNum) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return months[monthNum - 1] || "";
}

// NEW: extract user notes from arrears invoice description
function extractArrearsUserNotes(description) {
  const s = String(description || "");
  const marker = "Arrears before lease date. - ";
  if (s.startsWith(marker)) {
    return s.slice(marker.length).trim();
  }
  const idx = s.indexOf(" - ");
  if (idx >= 0) {
    return s.slice(idx + 3).trim();
  }
  return "";
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);

    const landlordId = toNumber(searchParams.get("landlordId"));
    const propertyId = toNumber(searchParams.get("propertyId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    if (!landlordId || !propertyId) {
      return Response.json(
        { error: "landlordId and propertyId are required" },
        { status: 400 },
      );
    }

    if (from && !isIsoDate(from)) {
      return Response.json(
        { error: "from must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    if (to && !isIsoDate(to)) {
      return Response.json(
        { error: "to must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    const fromDate = from || "1900-01-01";
    const toDate = to || "9999-12-31";

    const landlordRows = await sql`
      SELECT id, title, full_name
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    const propertyRows = await sql`
      SELECT id, property_name, landlord_id,
             management_fee_type, management_fee_percent, management_fee_fixed_amount
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `;

    const property = propertyRows?.[0] || null;
    if (!property) {
      return Response.json({ error: "Property not found" }, { status: 404 });
    }

    if (Number(property.landlord_id) !== Number(landlordId)) {
      return Response.json(
        { error: "This property is not linked to the selected landlord" },
        { status: 400 },
      );
    }

    // REQUIREMENT 1: Rent invoices - EXCLUDE arrears invoices (lease_id IS NULL)
    const invoiceQuery = `
      SELECT
        i.id,
        i.invoice_date,
        i.invoice_year,
        i.invoice_month,
        i.description,
        i.amount,
        COALESCE(i.currency,'UGX') AS currency,
        COALESCE(tn.full_name,'Tenant') AS tenant_name,
        COALESCE(u.unit_number,'') AS unit_number
      FROM invoices i
      LEFT JOIN tenants tn ON tn.id = i.tenant_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE i.property_id = $1
        AND i.status <> 'void'
        AND COALESCE(i.is_deleted, false) = false
        AND i.lease_id IS NOT NULL
        AND i.invoice_date >= $2::date
        AND i.invoice_date <= $3::date
      ORDER BY 
        i.invoice_year ASC, 
        i.invoice_month ASC, 
        (CASE WHEN u.unit_number ~ '^\\d+$' THEN u.unit_number::integer ELSE 999999 END),
        u.unit_number,
        i.id ASC
    `;

    const invoices = await sql(invoiceQuery, [propertyId, fromDate, toDate]);

    const currentMonthRentByCurrency = sumByCurrency(invoices, "amount");

    // REQUIREMENT 2: Get "recovered arrears" - individual payments on arrears invoices in the date range
    const recoveredArrearsQuery = `
      SELECT
        pia.id AS allocation_id,
        pia.amount_applied,
        i.id AS invoice_id,
        i.invoice_year,
        i.invoice_month,
        i.description AS invoice_description,
        COALESCE(i.currency, 'UGX') AS currency,
        p.payment_date,
        COALESCE(tn.full_name, 'Unknown') AS tenant_name
      FROM payment_invoice_allocations pia
      JOIN payments p ON p.id = pia.payment_id
      JOIN invoices i ON i.id = pia.invoice_id
      LEFT JOIN tenants tn ON tn.id = i.tenant_id
      WHERE i.property_id = $1
        AND i.lease_id IS NULL
        AND COALESCE(i.is_deleted, false) = false
        AND p.is_reversed = false
        AND p.payment_date >= $2::date
        AND p.payment_date <= $3::date
      ORDER BY i.invoice_year ASC, i.invoice_month ASC, pia.id ASC
    `;

    const recoveredArrearsRaw = await sql(recoveredArrearsQuery, [
      propertyId,
      fromDate,
      toDate,
    ]);

    // REQUIREMENT 2: Format recovered arrears with individual lines and user notes
    const recoveredArrears = recoveredArrearsRaw.map((r) => {
      const userNotes = extractArrearsUserNotes(r.invoice_description);
      const tenantName = r.tenant_name || "Unknown";
      const desc = userNotes
        ? `Recovered arrears - ${tenantName} - ${userNotes}`
        : `Recovered arrears - ${tenantName}`;

      return {
        allocation_id: r.allocation_id,
        invoice_id: r.invoice_id,
        invoice_year: r.invoice_year,
        invoice_month: r.invoice_month,
        description: desc,
        amount: Number(r.amount_applied || 0),
        currency: String(r.currency || "UGX"),
      };
    });

    const recoveredArrearsByCurrency = sumByCurrency(
      recoveredArrears,
      "amount",
    );

    // REQUIREMENT 3: Calculate "Total Rent" = current month invoices + recovered arrears
    const totalRentByCurrency = new Map();

    // Add current month rent
    for (const [currency, amount] of currentMonthRentByCurrency.entries()) {
      totalRentByCurrency.set(currency, amount);
    }

    // Add recovered arrears
    for (const [currency, amount] of recoveredArrearsByCurrency.entries()) {
      const prev = totalRentByCurrency.get(currency) || 0;
      totalRentByCurrency.set(currency, prev + amount);
    }

    const feeType = String(
      property.management_fee_type || "percent",
    ).toLowerCase();
    const percent = Number(property.management_fee_percent || 0);
    const fixedAmount = Number(property.management_fee_fixed_amount || 0);

    // REQUIREMENT 4 & 5: Calculate management fees
    const mgmtFeesByCurrency = new Map();

    if (feeType === "percent") {
      // REQUIREMENT 4: For percentage, calculate on "Total Rent" (invoices + recovered arrears)
      for (const [currency, totalRent] of totalRentByCurrency.entries()) {
        const feeTotal = round2((totalRent * percent) / 100);
        mgmtFeesByCurrency.set(currency, feeTotal);
      }
    } else if (feeType === "fixed") {
      // REQUIREMENT 5: For fixed amount, use the fixed amount as is
      // Apply to UGX only and cap at total rent to avoid negative net payable
      const totalRentUGX = totalRentByCurrency.get("UGX") || 0;
      if (totalRentUGX > 0) {
        mgmtFeesByCurrency.set("UGX", Math.min(fixedAmount, totalRentUGX));
      }
    }

    // Deductions (read-only)
    // EXCLUDE "Fees on recovered arrears" because those are already included
    // in the management fees calculation (which is based on Total Rent)
    const deductionsQuery = `
      SELECT id, deduction_date, description, amount
      FROM landlord_deductions
      WHERE landlord_id = $1
        AND property_id = $2
        AND COALESCE(is_deleted,false) = false
        AND deduction_date >= $3::date
        AND deduction_date <= $4::date
        AND LOWER(description) NOT LIKE 'fees on recovered arrears%'
      ORDER BY deduction_date ASC, id ASC
    `;

    const deductions = await sql(deductionsQuery, [
      landlordId,
      propertyId,
      fromDate,
      toDate,
    ]);

    // Other deductions may not have currency in schema; assume UGX.
    const otherDeductionsTotal = (deductions || []).reduce((acc, d) => {
      return acc + Number(d.amount || 0);
    }, 0);

    const totals = Array.from(totalRentByCurrency.entries()).map(
      ([currency, totalRent]) => {
        const currentMonthRent = Number(
          currentMonthRentByCurrency.get(currency) || 0,
        );
        const recoveredAmount = Number(
          recoveredArrearsByCurrency.get(currency) || 0,
        );
        const fees = Number(mgmtFeesByCurrency.get(currency) || 0);
        const other = currency === "UGX" ? otherDeductionsTotal : 0;
        const totalDeductions = fees + other;
        const netPayable = totalRent - totalDeductions;
        return {
          currency,
          current_month_rent: currentMonthRent,
          recovered_arrears: recoveredAmount,
          total_rent: totalRent,
          management_fees: fees,
          other_deductions: other,
          total_deductions: totalDeductions,
          net_payable: netPayable,
        };
      },
    );

    if (totals.length === 0) {
      totals.push({
        currency: "UGX",
        current_month_rent: 0,
        recovered_arrears: 0,
        total_rent: 0,
        management_fees: 0,
        other_deductions: otherDeductionsTotal,
        total_deductions: otherDeductionsTotal,
        net_payable: 0 - otherDeductionsTotal,
      });
    }

    return Response.json({
      landlord,
      property,
      filters: { from: from || null, to: to || null },
      invoices,
      recovered_arrears: recoveredArrears,
      deductions,
      totals,
    });
  } catch (error) {
    console.error("GET /api/reports/payment-note error", error);

    const includeDetails =
      process.env.NODE_ENV !== "production" && process.env.ENV !== "production";

    return Response.json(
      {
        error: "Failed to build payment note",
        ...(includeDetails ? { details: String(error?.message || error) } : {}),
      },
      { status: 500 },
    );
  }
}
