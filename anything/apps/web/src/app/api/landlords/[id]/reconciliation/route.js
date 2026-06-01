import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId)
      return Response.json({ error: "Invalid id" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = toNumber(searchParams.get("month")) || now.getMonth() + 1;
    const year = toNumber(searchParams.get("year")) || now.getFullYear();

    if (month < 1 || month > 12)
      return Response.json({ error: "month must be 1-12" }, { status: 400 });

    const yearMonth = year * 100 + month;
    const mm = String(month).padStart(2, "0");
    const firstDay = `${year}-${mm}-01`;
    const lastDayDate = new Date(year, month, 0);
    const lastDay = `${year}-${mm}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

    const landlordRows = await sql`SELECT id, full_name FROM landlords WHERE id = ${landlordId} LIMIT 1`;

    const landlord = landlordRows?.[0] || null;
    if (!landlord)
      return Response.json({ error: "Landlord not found" }, { status: 404 });

    // All properties for this landlord
    const properties = await sql`
      SELECT id, management_fee_type, management_fee_percent, management_fee_fixed_amount
      FROM properties
      WHERE landlord_id = ${landlordId}
    `;

    // Closing balance from statement logic, cumulative up to end of month:
    //   gross_rent - management_fees - deductions - maintenance - payouts
    // summed across all properties of this landlord.
    let closingBalance = 0;

    for (const prop of properties || []) {
      const propId = Number(prop.id);
      const feeType = String(prop.management_fee_type || "percent").toLowerCase();
      const feePercent = Number(prop.management_fee_percent || 0);
      const feeFixed = Number(prop.management_fee_fixed_amount || 0);

      // Gross rent and per-month management fee, grouped by (year, month)
      const invoiceGroups = await sql`
        SELECT invoice_year, invoice_month, COALESCE(SUM(amount), 0)::numeric AS gross
        FROM invoices
        WHERE property_id = ${propId}
          AND invoice_date <= ${lastDay}::date
          AND status <> 'void'
          AND COALESCE(is_deleted, false) = false
        GROUP BY invoice_year, invoice_month
      `;
      let grossRent = 0;
      let mgmtFee = 0;
      for (const g of invoiceGroups || []) {
        const gross = Number(g.gross || 0);
        grossRent += gross;
        if (gross > 0) {
          if (feeType === "percent") {
            mgmtFee += round2((gross * feePercent) / 100);
          } else if (feeType === "fixed") {
            mgmtFee += Math.min(feeFixed, gross);
          }
        }
      }

      const [dedRow] = await sql`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total
        FROM landlord_deductions
        WHERE property_id = ${propId}
          AND deduction_date <= ${lastDay}::date
          AND COALESCE(is_deleted, false) = false
      `;
      const deductions = Number(dedRow?.total || 0);

      const [maintRow] = await sql`
        SELECT COALESCE(SUM(completed_cost), 0)::numeric AS total
        FROM maintenance_requests
        WHERE property_id = ${propId}
          AND charge_type = 'landlord'
          AND status IN ('completed', 'closed')
          AND completed_cost IS NOT NULL
          AND COALESCE(completed_date, completed_at::date) <= ${lastDay}::date
      `;
      const maintenance = Number(maintRow?.total || 0);

      const [payoutRow] = await sql`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total
        FROM landlord_payouts
        WHERE property_id = ${propId}
          AND payout_date <= ${lastDay}::date
          AND COALESCE(is_deleted, false) = false
      `;
      const payouts = Number(payoutRow?.total || 0);

      closingBalance += grossRent - mgmtFee - deductions - maintenance - payouts;
    }

    let paymentNoteNet = 0;

    for (const prop of properties || []) {
      const propId = Number(prop.id);
      const feeType = String(prop.management_fee_type || "percent").toLowerCase();
      const feePercent = Number(prop.management_fee_percent || 0);
      const feeFixed = Number(prop.management_fee_fixed_amount || 0);

      // Current month invoices (by year-month integer, not invoice_date)
      const invoiceRows = await sql`
        SELECT amount FROM invoices
        WHERE property_id = ${propId}
          AND invoice_year * 100 + invoice_month = ${yearMonth}
          AND status <> 'void'
          AND COALESCE(is_deleted, false) = false
          AND lease_id IS NOT NULL
      `;
      const currentRent = invoiceRows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );

      // Recovered arrears: payments on arrears invoices with payment_date in month
      const arrearsRows = await sql`
        SELECT pia.amount_applied
        FROM payment_invoice_allocations pia
        JOIN payments p ON p.id = pia.payment_id
        JOIN invoices i ON i.id = pia.invoice_id
        WHERE i.property_id = ${propId}
          AND i.lease_id IS NULL
          AND COALESCE(i.is_deleted, false) = false
          AND p.is_reversed = false
          AND p.payment_date >= ${firstDay}::date
          AND p.payment_date <= ${lastDay}::date
      `;
      const recoveredArrears = arrearsRows.reduce(
        (s, r) => s + Number(r.amount_applied || 0),
        0,
      );

      const totalRent = currentRent + recoveredArrears;

      let mgmtFee = 0;
      if (feeType === "percent") {
        mgmtFee = round2((totalRent * feePercent) / 100);
      } else if (feeType === "fixed" && totalRent > 0) {
        mgmtFee = Math.min(feeFixed, totalRent);
      }

      // Landlord deductions in month
      const dedRows = await sql`
        SELECT amount FROM landlord_deductions
        WHERE landlord_id = ${landlordId}
          AND property_id = ${propId}
          AND COALESCE(is_deleted, false) = false
          AND deduction_date >= ${firstDay}::date
          AND deduction_date <= ${lastDay}::date
          AND LOWER(description) NOT LIKE 'fees on recovered arrears%'
      `;
      const deductions = dedRows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );

      // Maintenance charged to this landlord in month
      const [maintRow] = await sql`
        SELECT COALESCE(SUM(completed_cost), 0)::numeric AS total
        FROM maintenance_requests
        WHERE property_id = ${propId}
          AND charge_type = 'landlord'
          AND status IN ('completed', 'closed')
          AND completed_cost IS NOT NULL
          AND COALESCE(completed_date, completed_at::date) >= ${firstDay}::date
          AND COALESCE(completed_date, completed_at::date) <= ${lastDay}::date
      `;
      const maintenanceTotal = Number(maintRow?.total || 0);

      paymentNoteNet += totalRent - mgmtFee - deductions - maintenanceTotal;
    }

    // Check if a payout snapshot exists for this landlord this month
    let snapshotCount = 0;
    let snapshotPaid = 0;
    try {
      const [snapshotRow] = await sql`
        SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_paid), 0) AS total_paid
        FROM landlord_payment_notes
        WHERE landlord_id = ${landlordId}
          AND month = ${month}
          AND year = ${year}
      `;
      snapshotCount = Number(snapshotRow?.cnt || 0);
      snapshotPaid = Number(snapshotRow?.total_paid || 0);
    } catch {
      snapshotCount = 0;
    }

    if (snapshotCount > 0) {
      return Response.json({
        landlord_id: landlordId,
        landlord_name: landlord.full_name,
        month,
        year,
        closing_balance: round2(closingBalance),
        payment_note_net: round2(paymentNoteNet),
        difference: 0,
        is_reconciled: true,
        suggested_action: null,
        snapshot_paid: round2(snapshotPaid),
      });
    }

    // positive difference → GL overstates (deduction needed)
    // negative difference → GL understates (credit needed)
    const difference = round2(closingBalance - paymentNoteNet);
    const isReconciled = Math.abs(difference) < 1;

    return Response.json({
      landlord_id: landlordId,
      landlord_name: landlord.full_name,
      month,
      year,
      closing_balance: round2(closingBalance),
      payment_note_net: round2(paymentNoteNet),
      difference,
      is_reconciled: isReconciled,
      suggested_action: isReconciled ? null : difference > 0 ? "deduction" : "credit",
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch reconciliation" },
      { status: 500 },
    );
  }
}
