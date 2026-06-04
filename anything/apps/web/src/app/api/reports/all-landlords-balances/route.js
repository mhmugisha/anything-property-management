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

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// Which report column a GL transaction's source_type contributes to. Every
// source_type that can touch account 2100 is mapped so the visible columns
// always reconcile to the raw credit/debit net. Unknown types fall to "other".
const SOURCE_TYPE_CATEGORY = {
  rent_accrual_summary: "rent",
  rent_reversal: "rent",
  mgmt_fee_summary: "fee",
  mgmt_fee_fixed: "fee",
  mgmt_fee_reversal: "fee",
  landlord_deduction: "deduction",
  maintenance: "maintenance",
  landlord_payout: "payout",
  landlord_balance_payout: "payout",
  landlord_credit: "other",
  reconciliation: "other",
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

    // 1. Account 2100 (Due to Landlords) is the source of truth for landlord
    //    balances — the same ledger account the landlord property statement
    //    uses. Credits to 2100 increase what we owe; debits decrease it.
    const [acct2100Rows, landlordRows, propertyRows] = await Promise.all([
      sql`SELECT id FROM chart_of_accounts WHERE account_code = '2100' LIMIT 1`,
      landlordId
        ? sql`SELECT id, full_name FROM landlords WHERE id = ${landlordId} ORDER BY full_name ASC`
        : sql`SELECT id, full_name FROM landlords ORDER BY full_name ASC`,
      landlordId
        ? sql`SELECT id, landlord_id FROM properties WHERE landlord_id = ${landlordId}`
        : sql`SELECT id, landlord_id FROM properties`,
    ]);

    const acct2100Id = Number(acct2100Rows?.[0]?.id) || null;
    if (!acct2100Id) {
      return Response.json(
        { error: "Account 2100 (Due to Landlords) not configured" },
        { status: 500 },
      );
    }

    const landlords = landlordRows || [];
    const landlordIds = landlords.map((l) => Number(l.id));

    // property_id -> owning landlord_id, so property-level postings roll up to
    // the right landlord.
    const propertyToLandlord = new Map();
    for (const p of propertyRows || []) {
      propertyToLandlord.set(Number(p.id), Number(p.landlord_id));
    }
    const propertyIds = Array.from(propertyToLandlord.keys());

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

    // 2. Every approved, non-deleted GL movement touching account 2100 for the
    //    scoped properties (property-level entries) plus landlord-level entries
    //    that carry no property. Fetch all history; the opening-vs-period split
    //    happens in JS so opening balances reflect any historical corrections.
    const txnRows = await sql`
      SELECT transaction_date, amount, debit_account_id, credit_account_id,
             property_id, landlord_id, source_type
      FROM transactions
      WHERE (debit_account_id = ${acct2100Id} OR credit_account_id = ${acct2100Id})
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND (
          property_id = ANY(${propertyIds}::int[])
          OR (property_id IS NULL AND landlord_id = ANY(${landlordIds}::int[]))
        )
    `;

    for (const t of txnRows || []) {
      // Attribute to a landlord: property-level entries via the property's
      // owner; landlord-level (no property) entries via landlord_id.
      let lid = null;
      if (t.property_id !== null && t.property_id !== undefined) {
        lid = propertyToLandlord.get(Number(t.property_id)) ?? null;
      } else if (t.landlord_id !== null && t.landlord_id !== undefined) {
        lid = Number(t.landlord_id);
      }
      if (lid === null) continue;

      const bucket = acc.get(lid);
      if (!bucket) continue;

      const date = toDateStr(t.transaction_date);
      if (!date) continue;
      if (date > to) continue; // ignore activity after the period

      const amount = Number(t.amount || 0);
      const isCredit = Number(t.credit_account_id) === acct2100Id;
      const delta = isCredit ? amount : -amount; // effect on amount owed

      if (date < from) {
        bucket.opening += delta;
        continue;
      }

      // Within [from, to]: bucket the signed delta by source_type category.
      const category = SOURCE_TYPE_CATEGORY[t.source_type] || "other";
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

      totals.opening_balance += opening_balance;
      totals.period_rent += period_rent;
      totals.period_fees += period_fees;
      totals.period_deductions += period_deductions;
      totals.period_maintenance += period_maintenance;
      totals.period_payouts += period_payouts;
      totals.period_other += period_other;
      totals.closing_balance += closing_balance;

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
