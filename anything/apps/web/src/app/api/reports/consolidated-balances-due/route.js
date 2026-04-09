import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const landlordIdParam = searchParams.get("landlordId");
    const landlordId = landlordIdParam ? Number(landlordIdParam) : null;
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const fromDate = from || "1900-01-01";
    const toDate = to || "9999-12-31";

    // MODE 1: Show all landlords (when no landlordId is provided)
    if (!landlordId) {
      // Get all landlords
      const landlordsRows = await sql`
        SELECT id, full_name
        FROM landlords
        ORDER BY full_name
      `;

      const landlords = [];

      for (const landlord of landlordsRows || []) {
        const llId = landlord.id;

        // Get all properties for this landlord
        const propertiesRows = await sql`
          SELECT id, property_name, 
                 management_fee_type, management_fee_percent, management_fee_fixed_amount
          FROM properties
          WHERE landlord_id = ${llId}
        `;

        let rentTotal = 0;
        let managementFeesTotal = 0;
        let otherDeductionsTotal = 0;
        let reversalsTotal = 0;

        for (const property of propertiesRows || []) {
          const propertyId = property.id;

          // Get invoices for this property
          const invoices = await sql`
            SELECT i.invoice_year, i.invoice_month, i.amount, COALESCE(i.currency,'UGX') AS currency
            FROM invoices i
            WHERE i.property_id = ${propertyId}
              AND i.status <> 'void'
              AND COALESCE(i.is_deleted, false) = false
              AND i.invoice_date >= ${fromDate}::date
              AND i.invoice_date <= ${toDate}::date
          `;

          // Calculate rent for this property
          const propertyRent = (invoices || []).reduce((sum, inv) => {
            return sum + Number(inv.amount || 0);
          }, 0);
          rentTotal += propertyRent;

          // Calculate management fees
          const feeType = String(
            property.management_fee_type || "percent",
          ).toLowerCase();
          const percent = Number(property.management_fee_percent || 0);
          const fixedAmount = Number(property.management_fee_fixed_amount || 0);

          // Group by year-month to calculate fees per month
          const monthGroups = new Map();
          for (const inv of invoices || []) {
            const key = `${inv.invoice_year}-${inv.invoice_month}`;
            const prev = monthGroups.get(key) || [];
            prev.push(inv);
            monthGroups.set(key, prev);
          }

          for (const monthInvoices of monthGroups.values()) {
            const gross = monthInvoices.reduce(
              (sum, r) => sum + Number(r.amount || 0),
              0,
            );

            let feeForMonth = 0;
            if (feeType === "percent") {
              feeForMonth = round2((gross * percent) / 100);
            } else if (feeType === "fixed") {
              feeForMonth = Math.min(fixedAmount, gross);
            }
            managementFeesTotal += feeForMonth;
          }

          // Get management fee reversals for this property
          const mgmtFeeReversals = await sql`
            SELECT COALESCE(SUM(amount), 0) AS mgmt_reversal_total
            FROM transactions
            WHERE property_id = ${propertyId}
              AND source_type = 'mgmt_fee_reversal'
              AND COALESCE(is_deleted, false) = false
              AND transaction_date >= ${fromDate}::date
              AND transaction_date <= ${toDate}::date
          `;

          // Subtract management fee reversals from management fees
          managementFeesTotal -= Number(
            mgmtFeeReversals?.[0]?.mgmt_reversal_total || 0,
          );

          // Get landlord deductions for this property
          const deductions = await sql`
            SELECT COALESCE(SUM(amount), 0) AS deduction_total
            FROM landlord_deductions
            WHERE landlord_id = ${llId}
              AND property_id = ${propertyId}
              AND COALESCE(is_deleted, false) = false
              AND deduction_date >= ${fromDate}::date
              AND deduction_date <= ${toDate}::date
          `;

          otherDeductionsTotal += Number(deductions?.[0]?.deduction_total || 0);

          // Get reversals for this property (rent_reversal only)
          const reversals = await sql`
            SELECT COALESCE(SUM(amount), 0) AS reversal_total
            FROM transactions
            WHERE property_id = ${propertyId}
              AND source_type = 'rent_reversal'
              AND COALESCE(is_deleted, false) = false
              AND transaction_date >= ${fromDate}::date
              AND transaction_date <= ${toDate}::date
          `;

          reversalsTotal += Number(reversals?.[0]?.reversal_total || 0);
        }

        // Get landlord payouts for this landlord
        const payouts = await sql`
          SELECT COALESCE(SUM(amount), 0) AS payout_total
          FROM landlord_payouts
          WHERE landlord_id = ${llId}
            AND COALESCE(is_deleted, false) = false
            AND payout_date >= ${fromDate}::date
            AND payout_date <= ${toDate}::date
        `;

        const totalPayouts = Number(payouts?.[0]?.payout_total || 0);

        const totalDeductions = managementFeesTotal + otherDeductionsTotal;
        const balanceDue =
          rentTotal - totalDeductions - reversalsTotal - totalPayouts;

        landlords.push({
          landlord_id: llId,
          landlord_name: landlord.full_name,
          rent_total: rentTotal,
          management_fees: managementFeesTotal,
          other_deductions: otherDeductionsTotal,
          reversals: reversalsTotal,
          payouts: totalPayouts,
          total_deductions: totalDeductions,
          balance_due: balanceDue,
        });
      }

      // Calculate grand totals
      const totalRent = landlords.reduce(
        (sum, l) => sum + Number(l.rent_total || 0),
        0,
      );
      const totalManagementFees = landlords.reduce(
        (sum, l) => sum + Number(l.management_fees || 0),
        0,
      );
      const totalOtherDeductions = landlords.reduce(
        (sum, l) => sum + Number(l.other_deductions || 0),
        0,
      );
      const totalReversals = landlords.reduce(
        (sum, l) => sum + Number(l.reversals || 0),
        0,
      );
      const totalPayouts = landlords.reduce(
        (sum, l) => sum + Number(l.payouts || 0),
        0,
      );
      const totalDeductions = totalManagementFees + totalOtherDeductions;
      const totalBalanceDue =
        totalRent - totalDeductions - totalReversals - totalPayouts;

      return Response.json({
        mode: "all_landlords",
        filters: { from: from || null, to: to || null },
        landlords,
        totals: {
          rent_total: totalRent,
          management_fees: totalManagementFees,
          other_deductions: totalOtherDeductions,
          reversals: totalReversals,
          payouts: totalPayouts,
          total_deductions: totalDeductions,
          balance_due: totalBalanceDue,
        },
      });
    }

    // MODE 2: Show properties for a specific landlord (existing behavior)
    // Get landlord details
    const landlordRows = await sql`
      SELECT id, full_name, phone, email
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    // Get all properties for this landlord
    const propertiesRows = await sql`
      SELECT id, property_name, 
             management_fee_type, management_fee_percent, management_fee_fixed_amount
      FROM properties
      WHERE landlord_id = ${landlordId}
      ORDER BY property_name
    `;

    const properties = [];

    for (const property of propertiesRows || []) {
      const propertyId = property.id;

      // Get invoices for this property
      const invoices = await sql`
        SELECT i.invoice_year, i.invoice_month, i.amount, COALESCE(i.currency,'UGX') AS currency
        FROM invoices i
        WHERE i.property_id = ${propertyId}
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND i.invoice_date >= ${fromDate}::date
          AND i.invoice_date <= ${toDate}::date
        ORDER BY i.invoice_year ASC, i.invoice_month ASC
      `;

      // Calculate total rent
      const rentTotal = (invoices || []).reduce((sum, inv) => {
        return sum + Number(inv.amount || 0);
      }, 0);

      // Calculate management fees
      const feeType = String(
        property.management_fee_type || "percent",
      ).toLowerCase();
      const percent = Number(property.management_fee_percent || 0);
      const fixedAmount = Number(property.management_fee_fixed_amount || 0);

      const monthGroups = new Map();
      for (const inv of invoices || []) {
        const key = `${inv.invoice_year}-${inv.invoice_month}`;
        const prev = monthGroups.get(key) || [];
        prev.push(inv);
        monthGroups.set(key, prev);
      }

      let managementFeesTotal = 0;
      for (const monthInvoices of monthGroups.values()) {
        const gross = monthInvoices.reduce(
          (sum, r) => sum + Number(r.amount || 0),
          0,
        );

        let feeForMonth = 0;
        if (feeType === "percent") {
          feeForMonth = round2((gross * percent) / 100);
        } else if (feeType === "fixed") {
          feeForMonth = Math.min(fixedAmount, gross);
        }
        managementFeesTotal += feeForMonth;
      }

      // Get management fee reversals for this property
      const mgmtFeeReversals = await sql`
        SELECT COALESCE(SUM(amount), 0) AS mgmt_reversal_total
        FROM transactions
        WHERE property_id = ${propertyId}
          AND source_type = 'mgmt_fee_reversal'
          AND COALESCE(is_deleted, false) = false
          AND transaction_date >= ${fromDate}::date
          AND transaction_date <= ${toDate}::date
      `;

      // Subtract management fee reversals from management fees
      managementFeesTotal -= Number(
        mgmtFeeReversals?.[0]?.mgmt_reversal_total || 0,
      );

      // Get landlord deductions for this property
      const deductions = await sql`
        SELECT COALESCE(SUM(amount), 0) AS deduction_total
        FROM landlord_deductions
        WHERE landlord_id = ${landlordId}
          AND property_id = ${propertyId}
          AND COALESCE(is_deleted, false) = false
          AND deduction_date >= ${fromDate}::date
          AND deduction_date <= ${toDate}::date
      `;

      const otherDeductionsTotal = Number(
        deductions?.[0]?.deduction_total || 0,
      );

      // Get rent reversals for this property
      const reversals = await sql`
        SELECT COALESCE(SUM(amount), 0) AS reversal_total
        FROM transactions
        WHERE property_id = ${propertyId}
          AND source_type = 'rent_reversal'
          AND COALESCE(is_deleted, false) = false
          AND transaction_date >= ${fromDate}::date
          AND transaction_date <= ${toDate}::date
      `;

      const reversalsTotal = Number(reversals?.[0]?.reversal_total || 0);

      // Get landlord payouts for this property
      const payouts = await sql`
        SELECT COALESCE(SUM(amount), 0) AS payout_total
        FROM landlord_payouts
        WHERE landlord_id = ${landlordId}
          AND (property_id = ${propertyId} OR property_id IS NULL)
          AND COALESCE(is_deleted, false) = false
          AND payout_date >= ${fromDate}::date
          AND payout_date <= ${toDate}::date
      `;

      const payoutsTotal = Number(payouts?.[0]?.payout_total || 0);

      const totalDeductions = managementFeesTotal + otherDeductionsTotal;
      const balanceDue =
        rentTotal - totalDeductions - reversalsTotal - payoutsTotal;

      properties.push({
        property_id: propertyId,
        property_name: property.property_name,
        rent_total: rentTotal,
        management_fees: managementFeesTotal,
        other_deductions: otherDeductionsTotal,
        reversals: reversalsTotal,
        payouts: payoutsTotal,
        total_deductions: totalDeductions,
        balance_due: balanceDue,
      });
    }

    // Calculate grand totals
    const totalRent = properties.reduce(
      (sum, p) => sum + Number(p.rent_total || 0),
      0,
    );
    const totalManagementFees = properties.reduce(
      (sum, p) => sum + Number(p.management_fees || 0),
      0,
    );
    const totalOtherDeductions = properties.reduce(
      (sum, p) => sum + Number(p.other_deductions || 0),
      0,
    );
    const totalPayouts = properties.reduce(
      (sum, p) => sum + Number(p.payouts || 0),
      0,
    );
    const totalReversals = properties.reduce(
      (sum, p) => sum + Number(p.reversals || 0),
      0,
    );
    const totalDeductions = totalManagementFees + totalOtherDeductions;
    const totalBalanceDue =
      totalRent - totalDeductions - totalPayouts - totalReversals;

    return Response.json({
      mode: "single_landlord",
      landlord,
      filters: { from: from || null, to: to || null },
      properties,
      totals: {
        rent_total: totalRent,
        management_fees: totalManagementFees,
        other_deductions: totalOtherDeductions,
        payouts: totalPayouts,
        total_deductions: totalDeductions,
        balance_due: totalBalanceDue,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/consolidated-balances-due error", error);
    return Response.json(
      { error: "Failed to build consolidated balances due report" },
      { status: 500 },
    );
  }
}
