import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toDateStr(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

// First day of an invoice month, used to anchor monthly rent/fee rows.
function monthAnchorDate(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return `${y}-${pad2(m)}-01`;
}

function monthLabel(year, month) {
  const m = Number(month);
  const name = m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : `M${month}`;
  return `${name} ${year}`;
}

// Management fee for one month of gross rent on a property.
function computeMonthlyFee(property, gross) {
  if (!property) return 0;
  const type = String(property.management_fee_type || "percent")
    .trim()
    .toLowerCase();
  if (type === "fixed") {
    const fixed = Number(property.management_fee_fixed_amount || 0);
    return Number.isFinite(fixed) && fixed > 0 ? Math.round(fixed) : 0;
  }
  const pct = Number(property.management_fee_percent || 0);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round((Number(gross || 0) * pct) / 100);
}

const TYPE_ORDER = {
  rent_billed: 1,
  management_fee: 2,
  landlord_deduction: 3,
  maintenance_charge: 4,
  landlord_payout: 5,
};

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const landlordId = toNumber(searchParams.get("landlordId"));
    const propertyId = toNumber(searchParams.get("propertyId"));
    const from = toDateStr((searchParams.get("from") || "").trim() || null);
    const to = toDateStr((searchParams.get("to") || "").trim() || null);

    if (!landlordId) {
      return Response.json({ error: "landlordId is required" }, { status: 400 });
    }

    // Landlord + every property they own (with fee settings) in one round trip.
    const [landlordRows, propertyRows] = await Promise.all([
      sql`SELECT id, full_name, phone, email FROM landlords WHERE id = ${landlordId} LIMIT 1`,
      sql`
        SELECT id, property_name, management_fee_type,
               management_fee_percent, management_fee_fixed_amount
        FROM properties
        WHERE landlord_id = ${landlordId}
      `,
    ]);

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    const propertyMap = new Map();
    for (const p of propertyRows || []) {
      propertyMap.set(Number(p.id), p);
    }

    const allPropIds = Array.from(propertyMap.keys());
    // Property-keyed sources (invoices, maintenance) are scoped to these ids.
    const scopedPropIds = propertyId
      ? allPropIds.includes(propertyId)
        ? [propertyId]
        : []
      : allPropIds;

    const propertyName = (pid) =>
      propertyMap.get(Number(pid))?.property_name || `Property #${pid}`;

    // Pull every source for the whole of history; date filtering (opening vs
    // period) happens in JS below so all row types share one consistent rule.
    const [invoiceRows, deductionRows, maintenanceRows, payoutRows] =
      await Promise.all([
        scopedPropIds.length
          ? sql`
              SELECT property_id, invoice_year, invoice_month,
                     SUM(amount) AS gross
              FROM invoices
              WHERE property_id = ANY(${scopedPropIds}::int[])
                AND COALESCE(is_deleted, false) = false
                AND COALESCE(approval_status, 'approved') = 'approved'
                AND COALESCE(status, '') <> 'void'
              GROUP BY property_id, invoice_year, invoice_month
            `
          : Promise.resolve([]),
        sql`
          SELECT id, property_id, deduction_date,
                 COALESCE(description, '') AS description, amount
          FROM landlord_deductions
          WHERE landlord_id = ${landlordId}
            AND COALESCE(is_deleted, false) = false
            AND COALESCE(approval_status, 'approved') = 'approved'
        `,
        scopedPropIds.length
          ? sql`
              SELECT id, property_id,
                     COALESCE(NULLIF(description, ''), title, '') AS description,
                     completed_cost,
                     COALESCE(completed_date, completed_at::date, created_at::date)
                       AS event_date
              FROM maintenance_requests
              WHERE property_id = ANY(${scopedPropIds}::int[])
                AND status IN ('completed', 'closed')
                AND charge_type = 'landlord'
                AND completed_cost IS NOT NULL
            `
          : Promise.resolve([]),
        sql`
          SELECT id, property_id, payout_date, reference_number, amount
          FROM landlord_payouts
          WHERE landlord_id = ${landlordId}
            AND COALESCE(is_deleted, false) = false
        `,
      ]);

    // Build a flat, undated-filtered event list. Each event carries the anchor
    // date used for ordering and opening/period partitioning.
    const events = [];

    // Rent billed (gross) + management fee, one pair per property-month.
    for (const r of invoiceRows || []) {
      const pid = Number(r.property_id);
      const year = Number(r.invoice_year);
      const month = Number(r.invoice_month);
      const date = monthAnchorDate(year, month);
      if (!date) continue;
      const gross = Number(r.gross || 0);
      const label = `${propertyName(pid)} - ${monthLabel(year, month)}`;

      events.push({
        id: `rent-${pid}-${year}-${pad2(month)}`,
        date,
        description: `Rent billed (gross) - ${label}`,
        source_type: "rent_billed",
        debit: 0,
        credit: gross,
      });

      const fee = computeMonthlyFee(propertyMap.get(pid), gross);
      if (fee > 0) {
        events.push({
          id: `fee-${pid}-${year}-${pad2(month)}`,
          date,
          description: `Management fee - ${label}`,
          source_type: "management_fee",
          debit: fee,
          credit: 0,
        });
      }
    }

    // Landlord deductions (optionally filtered to a single property).
    for (const r of deductionRows || []) {
      const pid = r.property_id === null ? null : Number(r.property_id);
      if (propertyId && pid !== propertyId) continue;
      const date = toDateStr(r.deduction_date);
      if (!date) continue;
      events.push({
        id: `deduction-${Number(r.id)}`,
        date,
        description: `Landlord deduction - ${r.description || `#${r.id}`}`,
        source_type: "landlord_deduction",
        debit: Number(r.amount || 0),
        credit: 0,
      });
    }

    // Maintenance charged to the landlord.
    for (const r of maintenanceRows || []) {
      const date = toDateStr(r.event_date);
      if (!date) continue;
      events.push({
        id: `maintenance-${Number(r.id)}`,
        date,
        description: `Maintenance charge - ${r.description || `#${r.id}`}`,
        source_type: "maintenance_charge",
        debit: Number(r.completed_cost || 0),
        credit: 0,
      });
    }

    // Landlord payouts (optionally filtered to a single property).
    for (const r of payoutRows || []) {
      const pid = r.property_id === null ? null : Number(r.property_id);
      if (propertyId && pid !== propertyId) continue;
      const date = toDateStr(r.payout_date);
      if (!date) continue;
      events.push({
        id: `payout-${Number(r.id)}`,
        date,
        description: `Landlord payout - ${r.reference_number || `#${r.id}`}`,
        source_type: "landlord_payout",
        debit: Number(r.amount || 0),
        credit: 0,
      });
    }

    // Chronological order, with a stable tie-break for same-dated rows.
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const ord =
        (TYPE_ORDER[a.source_type] || 99) - (TYPE_ORDER[b.source_type] || 99);
      if (ord !== 0) return ord;
      return String(a.id) < String(b.id) ? -1 : 1;
    });

    // Opening balance = net of every event strictly before `from`.
    // Period rows = events within [from, to].
    let openingBalance = 0;
    let balance = 0;
    let totalCredited = 0;
    let totalDebited = 0;
    const rows = [];

    if (from) {
      for (const e of events) {
        if (e.date < from) openingBalance += e.credit - e.debit;
      }
      balance = openingBalance;
      rows.push({
        id: "opening",
        date: from,
        description: "Opening Balance",
        source_type: "opening_balance",
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance,
      });
    }

    for (const e of events) {
      if (from && e.date < from) continue;
      if (to && e.date > to) continue;
      balance += e.credit - e.debit;
      totalCredited += e.credit;
      totalDebited += e.debit;
      rows.push({
        id: e.id,
        date: e.date,
        description: e.description,
        source_type: e.source_type,
        debit: e.debit,
        credit: e.credit,
        balance,
      });
    }

    return Response.json({
      landlord: {
        id: Number(landlord.id),
        full_name: landlord.full_name,
        phone: landlord.phone || null,
        email: landlord.email || null,
      },
      filters: { from: from || null, to: to || null },
      opening_balance: openingBalance,
      rows,
      summary: {
        credits: totalCredited,
        debits: totalDebited,
        closing_balance: balance,
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
