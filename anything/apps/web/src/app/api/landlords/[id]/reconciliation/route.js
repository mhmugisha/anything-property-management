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

    // STEP 1: Closing balance of account 2100 for this landlord — all cumulative movements up to end of month
    const [balRow] = await sql(
      `SELECT
         COALESCE(SUM(CASE WHEN credit_account_id = $1 THEN amount ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN debit_account_id = $1 THEN amount ELSE 0 END), 0)
         AS closing_balance
       FROM transactions
       WHERE (debit_account_id = $1 OR credit_account_id = $1)
         AND landlord_id = $2
         AND COALESCE(is_deleted, false) = false
         AND COALESCE(approval_status, 'approved') = 'approved'
         AND transaction_date <= $3::date`,
      [acct2100Id, landlordId, lastDay],
    );

    const closingBalance = Number(balRow?.closing_balance || 0);

    // STEP 2: Payment note net across all active properties for this landlord
    const properties = await sql(
      `SELECT id, management_fee_type, management_fee_percent, management_fee_fixed_amount
       FROM properties
       WHERE landlord_id = $1 AND COALESCE(is_deleted, false) = false`,
      [landlordId],
    );

    let paymentNoteNet = 0;

    for (const prop of properties || []) {
      const propId = Number(prop.id);
      const feeType = String(prop.management_fee_type || "percent").toLowerCase();
      const feePercent = Number(prop.management_fee_percent || 0);
      const feeFixed = Number(prop.management_fee_fixed_amount || 0);

      // Current month invoices (by year-month integer, not invoice_date)
      const invoiceRows = await sql(
        `SELECT amount FROM invoices
         WHERE property_id = $1
           AND invoice_year * 100 + invoice_month = $2
           AND status <> 'void'
           AND COALESCE(is_deleted, false) = false
           AND COALESCE(approval_status, 'approved') = 'approved'
           AND lease_id IS NOT NULL`,
        [propId, yearMonth],
      );
      const currentRent = invoiceRows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );

      // Recovered arrears: payments on arrears invoices with payment_date in month
      const arrearsRows = await sql(
        `SELECT pia.amount_applied
         FROM payment_invoice_allocations pia
         JOIN payments p ON p.id = pia.payment_id
         JOIN invoices i ON i.id = pia.invoice_id
         WHERE i.property_id = $1
           AND i.lease_id IS NULL
           AND COALESCE(i.is_deleted, false) = false
           AND p.is_reversed = false
           AND COALESCE(p.approval_status, 'approved') = 'approved'
           AND p.payment_date >= $2::date
           AND p.payment_date <= $3::date`,
        [propId, firstDay, lastDay],
      );
      const recoveredArrears = arrearsRows.reduce(
        (s, r) => s + Number(r.amount_applied || 0),
        0,
      );

      const totalRent = currentRent + recoveredArrears;

      // Management fees inline
      let mgmtFee = 0;
      if (feeType === "percent") {
        mgmtFee = round2((totalRent * feePercent) / 100);
      } else if (feeType === "fixed" && totalRent > 0) {
        mgmtFee = Math.min(feeFixed, totalRent);
      }

      // Landlord deductions in month
      const dedRows = await sql(
        `SELECT amount FROM landlord_deductions
         WHERE landlord_id = $1
           AND property_id = $2
           AND COALESCE(is_deleted, false) = false
           AND deduction_date >= $3::date
           AND deduction_date <= $4::date
           AND LOWER(description) NOT LIKE 'fees on recovered arrears%'`,
        [landlordId, propId, firstDay, lastDay],
      );
      const deductions = dedRows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );

      // Maintenance GL charges to this landlord (Dr 2100) in month
      const maintRows = await sql(
        `SELECT amount FROM transactions
         WHERE property_id = $1
           AND landlord_id = $2
           AND source_type = 'maintenance'
           AND debit_account_id = $3
           AND COALESCE(is_deleted, false) = false
           AND COALESCE(approval_status, 'approved') = 'approved'
           AND transaction_date >= $4::date
           AND transaction_date <= $5::date`,
        [propId, landlordId, acct2100Id, firstDay, lastDay],
      );
      const maintenanceTotal = maintRows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );

      paymentNoteNet += totalRent - mgmtFee - deductions - maintenanceTotal;
    }

    // difference = closing_balance - payment_note_net
    // positive → GL overstates (deduction needed); negative → GL understates (credit needed)
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
    console.error("GET /api/landlords/[id]/reconciliation error", error);
    return Response.json(
      { error: "Failed to fetch reconciliation" },
      { status: 500 },
    );
  }
}
