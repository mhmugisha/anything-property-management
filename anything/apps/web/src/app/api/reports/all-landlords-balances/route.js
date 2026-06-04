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

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();
    const landlordId = toNumber(searchParams.get("landlordId"));

    if (!isIsoDate(from)) {
      return Response.json(
        { error: "from is required and must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }
    if (!isIsoDate(to)) {
      return Response.json(
        { error: "to is required and must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    // 1. Landlords (all, or a single one when filtered) + every property they
    //    own (with fee settings) so we can map property -> landlord and compute
    //    per-month management fees later.
    const [landlordRows, propertyRows] = await Promise.all([
      landlordId
        ? sql`SELECT id, full_name FROM landlords WHERE id = ${landlordId} ORDER BY full_name ASC`
        : sql`SELECT id, full_name FROM landlords ORDER BY full_name ASC`,
      landlordId
        ? sql`
            SELECT id, property_name, landlord_id, management_fee_type,
                   management_fee_percent, management_fee_fixed_amount
            FROM properties
            WHERE landlord_id = ${landlordId}
          `
        : sql`
            SELECT id, property_name, landlord_id, management_fee_type,
                   management_fee_percent, management_fee_fixed_amount
            FROM properties
          `,
    ]);

    const landlords = landlordRows || [];
    const landlordIds = landlords.map((l) => Number(l.id));

    // property_id -> property (fee settings + owning landlord)
    const propertyMap = new Map();
    for (const p of propertyRows || []) {
      propertyMap.set(Number(p.id), p);
    }
    const propertyIds = Array.from(propertyMap.keys());

    // Initialise an accumulator for each landlord. Every landlord in scope
    // appears in the output, even with no activity in the period.
    const acc = new Map();
    for (const l of landlords) {
      acc.set(Number(l.id), {
        landlord_id: Number(l.id),
        landlord_name: l.full_name || `Landlord #${l.id}`,
        // Opening = statement closing balance as of (from - 1 day): the net of
        // every component accumulated separately, then combined at the end.
        opening_rent: 0,
        opening_fees: 0,
        opening_deductions: 0,
        opening_maintenance: 0,
        opening_payouts: 0,
        period_rent: 0,
        period_fees: 0,
        period_deductions: 0,
        period_maintenance: 0,
        period_payouts: 0,
      });
    }

    // 2. Pull every source for the whole of history; the opening-vs-period
    //    split happens in JS using the `from` boundary so opening balances
    //    dynamically reflect any corrections made to historical data.
    const [invoiceRows, deductionRows, maintenanceRows, payoutRows] =
      await Promise.all([
        propertyIds.length
          ? sql`
              SELECT property_id, invoice_year, invoice_month,
                     SUM(amount) AS gross
              FROM invoices
              WHERE property_id = ANY(${propertyIds}::int[])
                AND COALESCE(is_deleted, false) = false
                AND COALESCE(status, '') <> 'void'
                AND lease_id IS NOT NULL
              GROUP BY property_id, invoice_year, invoice_month
            `
          : Promise.resolve([]),
        landlordIds.length
          ? sql`
              SELECT landlord_id, property_id, deduction_date, amount
              FROM landlord_deductions
              WHERE landlord_id = ANY(${landlordIds}::int[])
                AND COALESCE(is_deleted, false) = false
            `
          : Promise.resolve([]),
        propertyIds.length
          ? sql`
              SELECT property_id, completed_cost,
                     COALESCE(completed_date, completed_at::date) AS event_date
              FROM maintenance_requests
              WHERE property_id = ANY(${propertyIds}::int[])
                AND charge_type = 'landlord'
                AND status IN ('completed', 'closed')
                AND completed_cost IS NOT NULL
            `
          : Promise.resolve([]),
        landlordIds.length
          ? sql`
              SELECT landlord_id, payout_date, amount
              FROM landlord_payouts
              WHERE landlord_id = ANY(${landlordIds}::int[])
                AND COALESCE(is_deleted, false) = false
            `
          : Promise.resolve([]),
      ]);

    // Helper: classify a date against the period boundary.
    //   < from           -> opening
    //   from..to (incl.) -> period
    //   > to             -> ignored (future activity)
    const inOpening = (date) => date < from;
    const inPeriod = (date) => date >= from && date <= to;

    // 3. Rent (gross) + management fee, one pair per property-month.
    for (const r of invoiceRows || []) {
      const property = propertyMap.get(Number(r.property_id));
      if (!property) continue;
      const bucket = acc.get(Number(property.landlord_id));
      if (!bucket) continue;
      const date = monthAnchorDate(r.invoice_year, r.invoice_month);
      if (!date) continue;
      const gross = Number(r.gross || 0);
      const fee = computeMonthlyFee(property, gross);

      if (inOpening(date)) {
        bucket.opening_rent += gross;
        bucket.opening_fees += fee;
      } else if (inPeriod(date)) {
        bucket.period_rent += gross;
        bucket.period_fees += fee;
      }
    }

    // 4. Landlord deductions (reduce the amount owed to the landlord).
    for (const r of deductionRows || []) {
      const bucket = acc.get(Number(r.landlord_id));
      if (!bucket) continue;
      const date = toDateStr(r.deduction_date);
      if (!date) continue;
      const amount = Number(r.amount || 0);
      if (inOpening(date)) {
        bucket.opening_deductions += amount;
      } else if (inPeriod(date)) {
        bucket.period_deductions += amount;
      }
    }

    // 5. Maintenance charged to the landlord.
    for (const r of maintenanceRows || []) {
      const property = propertyMap.get(Number(r.property_id));
      if (!property) continue;
      const bucket = acc.get(Number(property.landlord_id));
      if (!bucket) continue;
      const date = toDateStr(r.event_date);
      if (!date) continue;
      const amount = Number(r.completed_cost || 0);
      if (inOpening(date)) {
        bucket.opening_maintenance += amount;
      } else if (inPeriod(date)) {
        bucket.period_maintenance += amount;
      }
    }

    // 6. Landlord payouts (money already paid out to the landlord).
    for (const r of payoutRows || []) {
      const bucket = acc.get(Number(r.landlord_id));
      if (!bucket) continue;
      const date = toDateStr(r.payout_date);
      if (!date) continue;
      const amount = Number(r.amount || 0);
      if (inOpening(date)) {
        bucket.opening_payouts += amount;
      } else if (inPeriod(date)) {
        bucket.period_payouts += amount;
      }
    }

    // 7. Closing balance + totals.
    const totals = {
      opening_balance: 0,
      period_rent: 0,
      period_fees: 0,
      period_deductions: 0,
      period_maintenance: 0,
      period_payouts: 0,
      closing_balance: 0,
    };

    const landlordsOut = Array.from(acc.values()).map((b) => {
      // Opening balance mirrors the landlord statement's closing-balance logic,
      // applied to all activity strictly before `from`. Positive => we owe the
      // landlord money.
      const opening_balance =
        b.opening_rent -
        b.opening_fees -
        b.opening_deductions -
        b.opening_maintenance -
        b.opening_payouts;

      const closing_balance =
        opening_balance +
        b.period_rent -
        b.period_fees -
        b.period_deductions -
        b.period_maintenance -
        b.period_payouts;

      totals.opening_balance += opening_balance;
      totals.period_rent += b.period_rent;
      totals.period_fees += b.period_fees;
      totals.period_deductions += b.period_deductions;
      totals.period_maintenance += b.period_maintenance;
      totals.period_payouts += b.period_payouts;
      totals.closing_balance += closing_balance;

      return {
        landlord_id: b.landlord_id,
        landlord_name: b.landlord_name,
        opening_balance,
        period_rent: b.period_rent,
        period_fees: b.period_fees,
        period_deductions: b.period_deductions,
        period_maintenance: b.period_maintenance,
        period_payouts: b.period_payouts,
        closing_balance,
      };
    });

    return Response.json({
      filters: { from, to },
      landlords: landlordsOut,
      totals,
    });
  } catch (error) {
    console.error("GET /api/reports/all-landlords-balances error", error);
    const includeDetails =
      process.env.NODE_ENV !== "production" && process.env.ENV !== "production";
    const details = includeDetails
      ? String(error?.message || error)
      : undefined;
    return Response.json(
      {
        error: "Failed to build all landlords balances report",
        ...(details ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
