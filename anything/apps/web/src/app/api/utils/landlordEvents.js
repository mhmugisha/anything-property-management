import sql from "@/app/api/utils/sql";
import {
  managementFeeSettings,
  monthlyManagementFee,
} from "@/app/api/utils/accounting";

export function toDateStr(value) {
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
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12)
    return null;
  return `${y}-${pad2(m)}-01`;
}

function monthLabel(year, month) {
  const m = Number(month);
  const name = m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : `M${month}`;
  return `${name} ${year}`;
}

// Management fee for one month of gross rent on a property. Uses the same
// rounding/capping as getDueToLandlordsBalance so the closing balance matches.
function computeMonthlyFee(property, gross) {
  if (!property) return 0;
  return monthlyManagementFee(
    Number(gross || 0),
    managementFeeSettings(property),
  );
}

const TYPE_ORDER = {
  rent_billed: 1,
  management_fee: 2,
  landlord_deduction: 3,
  maintenance_charge: 4,
  landlord_payout: 5,
  balance_adjustment: 6,
};

/**
 * Every dated movement on what is due to a landlord, from the source tables —
 * the same rules as getDueToLandlordsBalance, so the net of all events equals
 * the helper's figure. Shared by the landlord statement and the balance
 * reports.
 *
 * Each event: { id, date, property_id, description, source_type, debit,
 * credit }. credit − debit is its signed effect on the amount due. Sorted
 * chronologically with a stable tie-break. Undated rows are skipped.
 *
 * source_type: rent_billed (credit), management_fee, landlord_deduction,
 * maintenance_charge, landlord_payout (debits), balance_adjustment (signed).
 *
 * @param {number} landlordId
 * @param {{ propertyId?: number|null }} [opts] limit to one property
 * @returns {Promise<{ properties: object[], events: object[] }>} properties
 *   are every property the landlord currently owns (with fee settings).
 */
export async function buildLandlordEvents(landlordId, { propertyId } = {}) {
  const propertyRows = await sql`
    SELECT id, property_name, management_fee_type,
           management_fee_percent, management_fee_fixed_amount
    FROM properties
    WHERE landlord_id = ${landlordId}
  `;

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

  // Pull every source for the whole of history; callers partition by date.
  const [
    invoiceRows,
    deductionRows,
    maintenanceRows,
    payoutRows,
    adjustmentRows,
  ] = await Promise.all([
    scopedPropIds.length
      ? sql`
            SELECT property_id, invoice_year, invoice_month,
                   SUM(amount) AS gross
            FROM invoices
            WHERE property_id = ANY(${scopedPropIds}::int[])
              AND COALESCE(is_deleted, false) = false
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
    sql`
        SELECT id, property_id,
               COALESCE(effective_date, created_at::date) AS event_date,
               COALESCE(reason, '') AS reason, amount
        FROM landlord_balance_adjustments
        WHERE landlord_id = ${landlordId}
          AND COALESCE(is_deleted, false) = false
      `,
  ]);

  const events = [];
  const pidOf = (r) => (r.property_id === null ? null : Number(r.property_id));

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
      property_id: pid,
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
        property_id: pid,
        description: `Management fee - ${label}`,
        source_type: "management_fee",
        debit: fee,
        credit: 0,
      });
    }
  }

  // Arrears invoices (lease_id IS NULL) are already credited above as rent
  // billed. The landlord is credited on a bill basis, once, so payments
  // recovering those arrears are not credited again.

  // Landlord deductions (optionally filtered to a single property).
  for (const r of deductionRows || []) {
    const pid = pidOf(r);
    if (propertyId && pid !== propertyId) continue;
    const date = toDateStr(r.deduction_date);
    if (!date) continue;
    events.push({
      id: `deduction-${Number(r.id)}`,
      date,
      property_id: pid,
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
      property_id: pidOf(r),
      description: `Maintenance charge - ${r.description || `#${r.id}`}`,
      source_type: "maintenance_charge",
      debit: Number(r.completed_cost || 0),
      credit: 0,
    });
  }

  // Landlord payouts (optionally filtered to a single property).
  for (const r of payoutRows || []) {
    const pid = pidOf(r);
    if (propertyId && pid !== propertyId) continue;
    const date = toDateStr(r.payout_date);
    if (!date) continue;
    events.push({
      id: `payout-${Number(r.id)}`,
      date,
      property_id: pid,
      description: `Landlord payout - ${r.reference_number || `#${r.id}`}`,
      source_type: "landlord_payout",
      debit: Number(r.amount || 0),
      credit: 0,
    });
  }

  // Balance adjustments are signed: + credits the landlord, − debits them.
  for (const r of adjustmentRows || []) {
    const pid = pidOf(r);
    if (propertyId && pid !== propertyId) continue;
    const date = toDateStr(r.event_date);
    if (!date) continue;
    const amount = Number(r.amount || 0);
    events.push({
      id: `adjustment-${Number(r.id)}`,
      date,
      property_id: pid,
      description: `Balance adjustment - ${r.reason || `#${r.id}`}`,
      source_type: "balance_adjustment",
      debit: amount < 0 ? -amount : 0,
      credit: amount > 0 ? amount : 0,
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

  return { properties: propertyRows || [], events };
}
