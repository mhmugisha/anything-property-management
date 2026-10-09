import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { buildLandlordEvents } from "@/app/api/utils/landlordEvents";

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// Which report column each landlord event contributes to. Balance adjustments
// show under "Other Adj."; unknown types also fall to "other".
const SOURCE_TYPE_CATEGORY = {
  rent_billed: "rent",
  management_fee: "fee",
  landlord_deduction: "deduction",
  maintenance_charge: "maintenance",
  landlord_payout: "payout",
  balance_adjustment: "other",
};

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

    // 1. Landlords in scope. Balances come from the same source-table events
    //    as the landlord statement and getDueToLandlordsBalance, so the
    //    all-time closing balance equals the dashboard's Due to Landlords.
    const landlordRows = landlordId
      ? await sql`SELECT id, full_name FROM landlords WHERE id = ${landlordId} ORDER BY full_name ASC`
      : await sql`SELECT id, full_name FROM landlords ORDER BY full_name ASC`;

    const landlords = landlordRows || [];
    const landlordIds = landlords.map((l) => Number(l.id));

    // One accumulator per landlord. Every landlord in scope appears in the
    // output, even with no ledger activity.
    const acc = new Map();
    for (const l of landlords) {
      acc.set(Number(l.id), {
        landlord_id: Number(l.id),
        landlord_name: l.full_name || `Landlord #${l.id}`,
        // Signed net effect on amount owed (credit +, debit -), per category.
        // opening = all activity before `from`; cat* = activity within range.
        opening: 0,
        catRent: 0,
        catFee: 0,
        catDeduction: 0,
        catMaintenance: 0,
        catPayout: 0,
        catOther: 0,
      });
    }

    if (landlordIds.length === 0) {
      return Response.json({
        filters: { from, to },
        landlords: [],
        totals: {
          opening_balance: 0,
          period_rent: 0,
          period_fees: 0,
          period_deductions: 0,
          period_maintenance: 0,
          period_payouts: 0,
          period_other: 0,
          closing_balance: 0,
        },
      });
    }

    // 2. Every dated event for each landlord. Fetch all history; the
    //    opening-vs-period split happens here so opening balances reflect any
    //    backdated entries.
    const eventsByLandlord = await Promise.all(
      landlordIds.map((lid) =>
        buildLandlordEvents(lid).then(({ events }) => [lid, events]),
      ),
    );

    for (const [lid, events] of eventsByLandlord) {
      const bucket = acc.get(lid);
      if (!bucket) continue;

      for (const e of events) {
        if (e.date > to) continue; // ignore activity after the period

        const delta = e.credit - e.debit; // effect on amount owed

        if (e.date < from) {
          bucket.opening += delta;
          continue;
        }

        // Within [from, to]: bucket the signed delta by event category.
        const category = SOURCE_TYPE_CATEGORY[e.source_type] || "other";
        switch (category) {
          case "rent":
            bucket.catRent += delta;
            break;
          case "fee":
            bucket.catFee += delta;
            break;
          case "deduction":
            bucket.catDeduction += delta;
            break;
          case "maintenance":
            bucket.catMaintenance += delta;
            break;
          case "payout":
            bucket.catPayout += delta;
            break;
          default:
            bucket.catOther += delta;
            break;
        }
      }
    }

    // 3. Project signed accumulators onto the report columns and reconcile.
    //    Rent/Other are credits (shown positive); Fees/Deductions/Maintenance/
    //    Payouts are charges (the negated debit net, shown positive and then
    //    subtracted). closing = opening + net of every period movement.
    const totals = {
      opening_balance: 0,
      period_rent: 0,
      period_fees: 0,
      period_deductions: 0,
      period_maintenance: 0,
      period_payouts: 0,
      period_other: 0,
      closing_balance: 0,
    };

    const landlordsOut = Array.from(acc.values()).map((b) => {
      const opening_balance = b.opening;
      const period_rent = b.catRent;
      const period_fees = -b.catFee;
      const period_deductions = -b.catDeduction;
      const period_maintenance = -b.catMaintenance;
      const period_payouts = -b.catPayout;
      const period_other = b.catOther;

      const closing_balance =
        opening_balance +
        period_rent -
        period_fees -
        period_deductions -
        period_maintenance -
        period_payouts +
        period_other;

      return {
        landlord_id: b.landlord_id,
        landlord_name: b.landlord_name,
        opening_balance,
        period_rent,
        period_fees,
        period_deductions,
        period_maintenance,
        period_payouts,
        period_other,
        closing_balance,
      };
    });

    // Drop landlords whose opening and closing balances are both effectively
    // zero (within 1 UGX either side) — they have nothing to report on.
    const filteredLandlords = landlordsOut.filter(
      (l) => Math.abs(l.opening_balance) > 1 || Math.abs(l.closing_balance) > 1,
    );

    for (const l of filteredLandlords) {
      totals.opening_balance += l.opening_balance;
      totals.period_rent += l.period_rent;
      totals.period_fees += l.period_fees;
      totals.period_deductions += l.period_deductions;
      totals.period_maintenance += l.period_maintenance;
      totals.period_payouts += l.period_payouts;
      totals.period_other += l.period_other;
      totals.closing_balance += l.closing_balance;
    }

    return Response.json({
      filters: { from, to },
      landlords: filteredLandlords,
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
