import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

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

    const [landlordRows, acct2100Id] = await Promise.all([
      sql`SELECT id, full_name FROM landlords WHERE id = ${landlordId} LIMIT 1`,
      getAccountIdByCode("2100"),
    ]);

    const landlord = landlordRows?.[0] || null;
    if (!landlord)
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    if (!acct2100Id)
      return Response.json(
        { error: "Account 2100 not configured" },
        { status: 500 },
      );

    // Closing balance of account 2100 for this landlord — all cumulative movements up to end of month
    const [balRow] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN credit_account_id = ${acct2100Id} THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN debit_account_id = ${acct2100Id} THEN amount ELSE 0 END), 0)
        AS closing_balance
      FROM transactions
      WHERE (debit_account_id = ${acct2100Id} OR credit_account_id = ${acct2100Id})
        AND landlord_id = ${landlordId}
        AND COALESCE(is_deleted, false) = false
        AND transaction_date <= ${lastDay}::date
    `;

    const closingBalance = Number(balRow?.closing_balance || 0);

    // Payment note net across all active properties for this landlord
    const properties = await sql`
      SELECT id, management_fee_type, management_fee_percent, management_fee_fixed_amount
      FROM properties
      WHERE landlord_id = ${landlordId}
    `;

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

      // Maintenance GL charges to this landlord (Dr 2100) in month
      const maintRows = await sql`
        SELECT amount FROM transactions
        WHERE property_id = ${propId}
          AND landlord_id = ${landlordId}
          AND source_type = 'maintenance'
          AND debit_account_id = ${acct2100Id}
          AND COALESCE(is_deleted, false) = false
          AND transaction_date >= ${firstDay}::date
          AND transaction_date <= ${lastDay}::date
      `;
      const maintenanceTotal = maintRows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );

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
