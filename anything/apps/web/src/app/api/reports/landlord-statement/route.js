import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { ensureInvoicesForAllActiveLeasesUpToCurrentMonth } from "@/app/api/utils/invoices";

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

function feeForGroup({ feeType, percent, fixedAmount, gross, currency }) {
  const t = String(feeType || "percent").toLowerCase();
  if (gross <= 0) return 0;

  if (t === "percent") {
    const p = Number(percent || 0);
    return round2((gross * p) / 100);
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
    const landlordId = Number(searchParams.get("landlordId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    if (!landlordId) {
      return Response.json(
        { error: "landlordId is required" },
        { status: 400 },
      );
    }

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

    const where = [`p.landlord_id = $1`, `i.status <> 'void'`, `COALESCE(i.approval_status, 'approved') = 'approved'`];
    const values = [landlordId];

    if (from) {
      where.push(`i.invoice_date >= $${values.length + 1}::date`);
      values.push(from);
    }

    if (to) {
      where.push(`i.invoice_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const invoicesQuery = `
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
        t.id AS tenant_id,
        t.full_name AS tenant_name,
        u.unit_number,
        p.id AS property_id,
        p.property_name,
        p.management_fee_type,
        p.management_fee_percent,
        p.management_fee_fixed_amount
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      LEFT JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN units u ON u.id = i.unit_id
      ${whereSql}
      ORDER BY i.invoice_year DESC, i.invoice_month DESC, i.id DESC
      LIMIT 2000
    `;

    const invoices = await sql(invoicesQuery, values);

    // Property-level management fees (one fee per property-month-currency).
    const feeGroups = new Map();
    for (const inv of invoices || []) {
      const key = `${inv.property_id}-${inv.invoice_year}-${inv.invoice_month}-${String(inv.currency || "UGX")}`;
      const prev = feeGroups.get(key) || [];
      prev.push(inv);
      feeGroups.set(key, prev);
    }

    let managementFeesTotal = 0;
    for (const rows of feeGroups.values()) {
      const sample = rows?.[0] || {};
      const gross = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const feeTotal = feeForGroup({
        feeType: sample.management_fee_type,
        percent: sample.management_fee_percent,
        fixedAmount: sample.management_fee_fixed_amount,
        gross,
        currency: sample.currency,
      });

      managementFeesTotal += Number(feeTotal || 0);
    }

    const paymentsWhere = [`p2.landlord_id = $1`];
    const paymentsValues = [landlordId];

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
        p2.property_name
      FROM payment_invoice_allocations pia
      JOIN payments pay ON pay.id = pia.payment_id
      JOIN invoices i ON i.id = pia.invoice_id
      JOIN properties p2 ON p2.id = i.property_id
      LEFT JOIN tenants t ON t.id = i.tenant_id
      WHERE ${paymentsWhere.join(" AND ")}
        AND pay.is_reversed = false
        AND COALESCE(pay.approval_status, 'approved') = 'approved'
        AND i.lease_id IS NOT NULL
      ORDER BY pay.payment_date DESC, pay.id DESC
      LIMIT 2000
    `;

    const payments = await sql(paymentsQuery, paymentsValues);

    const deductionsWhere = [`d.landlord_id = $1`, `COALESCE(d.approval_status, 'approved') = 'approved'`];
    const deductionsValues = [landlordId];

    if (from) {
      deductionsWhere.push(
        `d.deduction_date >= $${deductionsValues.length + 1}::date`,
      );
      deductionsValues.push(from);
    }

    if (to) {
      deductionsWhere.push(
        `d.deduction_date <= $${deductionsValues.length + 1}::date`,
      );
      deductionsValues.push(to);
    }

    const deductionsQuery = `
      SELECT
        d.id,
        d.deduction_date,
        d.description,
        d.amount,
        p.property_name
      FROM landlord_deductions d
      LEFT JOIN properties p ON p.id = d.property_id
      WHERE ${deductionsWhere.join(" AND ")}
      ORDER BY d.deduction_date DESC, d.id DESC
      LIMIT 2000
    `;

    const deductions = await sql(deductionsQuery, deductionsValues);

    // Fetch reversal transactions (rent_reversal ONLY - no mgmt_fee_reversal)
    const reversalsWhere = [];
    const reversalsValues = [];

    // Find all properties for this landlord
    const landlordPropertiesRows = await sql`
      SELECT id FROM properties WHERE landlord_id = ${landlordId}
    `;

    const propertyIds = landlordPropertiesRows.map((p) => p.id);

    if (propertyIds.length === 0) {
      // No properties, no reversals
      reversalsWhere.push("1 = 0");
    } else {
      reversalsWhere.push(
        `property_id IN (${propertyIds.map((_, idx) => `$${idx + 1}`).join(", ")})`,
      );
      reversalsValues.push(...propertyIds);

      reversalsWhere.push("source_type = 'rent_reversal'");
      reversalsWhere.push("COALESCE(is_deleted, false) = false");

      if (from) {
        reversalsWhere.push(
          `transaction_date >= $${reversalsValues.length + 1}::date`,
        );
        reversalsValues.push(from);
      }

      if (to) {
        reversalsWhere.push(
          `transaction_date <= $${reversalsValues.length + 1}::date`,
        );
        reversalsValues.push(to);
      }
    }

    const reversalsQuery = `
      SELECT
        t.id,
        t.transaction_date,
        t.description,
        t.amount,
        t.source_type,
        t.reference_number,
        p.property_name
      FROM transactions t
      LEFT JOIN properties p ON p.id = t.property_id
      WHERE ${reversalsWhere.join(" AND ")}
      ORDER BY t.transaction_date DESC, t.id DESC
      LIMIT 2000
    `;

    const reversals =
      propertyIds.length > 0 ? await sql(reversalsQuery, reversalsValues) : [];

    // Fetch landlord payouts
    const payoutsWhere = [
      `lp.landlord_id = $1`,
      `COALESCE(lp.is_deleted, false) = false`,
    ];
    const payoutsValues = [landlordId];

    if (from) {
      payoutsWhere.push(`lp.payout_date >= $${payoutsValues.length + 1}::date`);
      payoutsValues.push(from);
    }

    if (to) {
      payoutsWhere.push(`lp.payout_date <= $${payoutsValues.length + 1}::date`);
      payoutsValues.push(to);
    }

    const payoutsQuery = `
      SELECT
        lp.id,
        lp.payout_date,
        lp.amount,
        lp.payment_method,
        lp.reference_number,
        p.property_name
      FROM landlord_payouts lp
      LEFT JOIN properties p ON p.id = lp.property_id
      WHERE ${payoutsWhere.join(" AND ")}
      ORDER BY lp.payout_date DESC, lp.id DESC
      LIMIT 2000
    `;

    const payoutsRows = await sql(payoutsQuery, payoutsValues);

    // Calculate totals
    const grossRent = (invoices || []).reduce(
      (acc, inv) => acc + Number(inv.amount || 0),
      0,
    );

    const outstanding = (invoices || []).reduce(
      (acc, inv) => acc + Number(inv.outstanding || 0),
      0,
    );

    const deductionsTotal = (deductions || []).reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0,
    );

    const reversalsTotal = (reversals || []).reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0,
    );

    const payoutsTotal = (payoutsRows || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    // CRITICAL FIX: Balance = Gross rent - Management fees - Deductions - Reversals - Payouts
    // This must match the Consolidated Balances Due calculation
    const netDue =
      grossRent -
      managementFeesTotal -
      deductionsTotal -
      reversalsTotal -
      payoutsTotal;

    // NEW: Also calculate ALL-TIME totals (ignoring date filters) for the footer
    const allTimeInvoicesQuery = `
      SELECT
        i.id,
        i.invoice_date,
        i.amount,
        i.currency,
        p.id AS property_id,
        p.management_fee_type,
        p.management_fee_percent,
        p.management_fee_fixed_amount,
        i.invoice_year,
        i.invoice_month
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      WHERE p.landlord_id = $1
        AND i.status <> 'void'
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.approval_status, 'approved') = 'approved'
    `;
    const allTimeInvoices = await sql(allTimeInvoicesQuery, [landlordId]);

    // Calculate all-time management fees
    const allTimeFeeGroups = new Map();
    for (const inv of allTimeInvoices || []) {
      const key = `${inv.property_id}-${inv.invoice_year}-${inv.invoice_month}-${String(inv.currency || "UGX")}`;
      const prev = allTimeFeeGroups.get(key) || [];
      prev.push(inv);
      allTimeFeeGroups.set(key, prev);
    }

    let allTimeManagementFeesTotal = 0;
    for (const rows of allTimeFeeGroups.values()) {
      const sample = rows?.[0] || {};
      const gross = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const feeTotal = feeForGroup({
        feeType: sample.management_fee_type,
        percent: sample.management_fee_percent,
        fixedAmount: sample.management_fee_fixed_amount,
        gross,
        currency: sample.currency,
      });
      allTimeManagementFeesTotal += Number(feeTotal || 0);
    }

    const allTimeGrossRent = (allTimeInvoices || []).reduce(
      (acc, inv) => acc + Number(inv.amount || 0),
      0,
    );

    // All-time deductions
    const allTimeDeductionsQuery = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM landlord_deductions
      WHERE landlord_id = $1
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
    `;
    const allTimeDeductionsRows = await sql(allTimeDeductionsQuery, [
      landlordId,
    ]);
    const allTimeDeductionsTotal = Number(allTimeDeductionsRows[0]?.total || 0);

    // All-time reversals
    const allTimeReversalsQuery =
      propertyIds.length > 0
        ? `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE property_id IN (${propertyIds.map((_, idx) => `$${idx + 1}`).join(", ")})
          AND source_type = 'rent_reversal'
          AND COALESCE(is_deleted, false) = false
      `
        : `SELECT 0 AS total`;
    const allTimeReversalsRows =
      propertyIds.length > 0
        ? await sql(allTimeReversalsQuery, propertyIds)
        : [{ total: 0 }];
    const allTimeReversalsTotal = Number(allTimeReversalsRows[0]?.total || 0);

    // All-time payouts
    const allTimePayoutsQuery = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM landlord_payouts
      WHERE landlord_id = $1
        AND COALESCE(is_deleted, false) = false
    `;
    const allTimePayoutsRows = await sql(allTimePayoutsQuery, [landlordId]);
    const allTimePayoutsTotal = Number(allTimePayoutsRows[0]?.total || 0);

    // All-time net due
    const allTimeNetDue =
      allTimeGrossRent -
      allTimeManagementFeesTotal -
      allTimeDeductionsTotal -
      allTimeReversalsTotal -
      allTimePayoutsTotal;

    return Response.json({
      landlord,
      filters: { from: from || null, to: to || null },
      invoices,
      payments,
      deductions,
      reversals,
      payouts: payoutsRows,
      totals: {
        gross_rent: grossRent,
        management_fees: managementFeesTotal,
        deductions: deductionsTotal,
        reversals: reversalsTotal,
        payouts: payoutsTotal,
        outstanding,
        net_due: netDue,
      },
      allTimeTotals: {
        gross_rent: allTimeGrossRent,
        management_fees: allTimeManagementFeesTotal,
        deductions: allTimeDeductionsTotal,
        reversals: allTimeReversalsTotal,
        payouts: allTimePayoutsTotal,
        net_due: allTimeNetDue,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/landlord-statement error", error);
    return Response.json(
      { error: "Failed to build landlord statement" },
      { status: 500 },
    );
  }
}
