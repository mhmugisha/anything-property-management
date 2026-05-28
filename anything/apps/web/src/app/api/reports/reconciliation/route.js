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

async function computePropertyReconciliation({
  landlordId,
  propId,
  acct2100Id,
  yearMonth,
  firstDay,
  lastDay,
  feeType,
  feePercent,
  feeFixed,
}) {
  // GL net for this property in the month
  const glRows = await sql(
    `SELECT amount, debit_account_id, credit_account_id
     FROM transactions
     WHERE property_id = $1
       AND landlord_id = $2
       AND (debit_account_id = $3 OR credit_account_id = $3)
       AND COALESCE(is_deleted, false) = false
       AND COALESCE(approval_status, 'approved') = 'approved'
       AND transaction_date >= $4::date
       AND transaction_date <= $5::date`,
    [propId, landlordId, acct2100Id, firstDay, lastDay],
  );

  let glNet = 0;
  for (const r of glRows || []) {
    const amt = Number(r.amount || 0);
    if (Number(r.credit_account_id) === acct2100Id) glNet += amt;
    else glNet -= amt;
  }

  // Current month invoices
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

  // Recovered arrears
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

  let mgmtFee = 0;
  if (feeType === "percent") {
    mgmtFee = round2((totalRent * feePercent) / 100);
  } else if (feeType === "fixed" && totalRent > 0) {
    mgmtFee = Math.min(feeFixed, totalRent);
  }

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
  const deductions = dedRows.reduce((s, r) => s + Number(r.amount || 0), 0);

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

  const paymentNoteNet = totalRent - mgmtFee - deductions - maintenanceTotal;
  const difference = round2(paymentNoteNet - glNet);
  const isReconciled = Math.abs(difference) < 1;

  return {
    gl_net: round2(glNet),
    payment_note_net: round2(paymentNoteNet),
    difference,
    is_reconciled: isReconciled,
    suggested_action: isReconciled
      ? null
      : difference > 0
        ? "credit"
        : "deduction",
  };
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
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

    const acct2100Id = await getAccountIdByCode("2100");
    if (!acct2100Id)
      return Response.json({ error: "Account 2100 not configured" }, { status: 500 });

    const landlords = await sql`
      SELECT id, full_name
      FROM landlords
      WHERE COALESCE(status, 'active') = 'active'
      ORDER BY full_name ASC
    `;

    const result = [];

    for (const landlord of landlords || []) {
      const landlordId = Number(landlord.id);

      const properties = await sql(
        `SELECT id, property_name, management_fee_type, management_fee_percent, management_fee_fixed_amount
         FROM properties
         WHERE landlord_id = $1 AND COALESCE(is_deleted, false) = false
         ORDER BY property_name ASC`,
        [landlordId],
      );

      const propertyResults = [];
      let totalGlNet = 0;
      let totalPaymentNoteNet = 0;

      for (const prop of properties || []) {
        const propId = Number(prop.id);
        const feeType = String(prop.management_fee_type || "percent").toLowerCase();
        const feePercent = Number(prop.management_fee_percent || 0);
        const feeFixed = Number(prop.management_fee_fixed_amount || 0);

        const rec = await computePropertyReconciliation({
          landlordId,
          propId,
          acct2100Id,
          yearMonth,
          firstDay,
          lastDay,
          feeType,
          feePercent,
          feeFixed,
        });

        propertyResults.push({
          property_id: propId,
          property_name: prop.property_name,
          ...rec,
        });

        totalGlNet += rec.gl_net;
        totalPaymentNoteNet += rec.payment_note_net;
      }

      const totalDifference = round2(totalPaymentNoteNet - totalGlNet);
      const isFullyReconciled =
        propertyResults.length > 0 &&
        propertyResults.every((p) => p.is_reconciled);

      result.push({
        landlord_id: landlordId,
        landlord_name: landlord.full_name,
        properties: propertyResults,
        total_gl_net: round2(totalGlNet),
        total_payment_note_net: round2(totalPaymentNoteNet),
        total_difference: totalDifference,
        is_fully_reconciled: isFullyReconciled,
      });
    }

    return Response.json({ month, year, landlords: result });
  } catch (error) {
    console.error("GET /api/reports/reconciliation error", error);
    return Response.json(
      { error: "Failed to build reconciliation report" },
      { status: 500 },
    );
  }
}
