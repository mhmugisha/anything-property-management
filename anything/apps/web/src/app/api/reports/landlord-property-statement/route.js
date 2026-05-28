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

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const landlordId = toNumber(searchParams.get("landlordId"));
    const propertyId = toNumber(searchParams.get("propertyId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    if (from && !isIsoDate(from)) {
      return Response.json(
        { error: "from must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }
    if (to && !isIsoDate(to)) {
      return Response.json(
        { error: "to must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }
    if (!landlordId || !propertyId) {
      return Response.json(
        { error: "landlordId and propertyId are required" },
        { status: 400 },
      );
    }

    const [landlordRows, propertyRows, acct2100Rows] = await Promise.all([
      sql`SELECT id, title, full_name, phone, email FROM landlords WHERE id = ${landlordId} LIMIT 1`,
      sql`SELECT id, property_name, management_fee_type, management_fee_percent, management_fee_fixed_amount, landlord_id FROM properties WHERE id = ${propertyId} LIMIT 1`,
      sql`SELECT id FROM chart_of_accounts WHERE account_code = '2100' LIMIT 1`,
    ]);

    const landlord = landlordRows?.[0] || null;
    if (!landlord)
      return Response.json({ error: "Landlord not found" }, { status: 404 });

    const property = propertyRows?.[0] || null;
    if (!property)
      return Response.json({ error: "Property not found" }, { status: 404 });

    if (Number(property.landlord_id) !== landlordId) {
      return Response.json(
        { error: "Property not linked to this landlord" },
        { status: 400 },
      );
    }

    const acct2100Id = Number(acct2100Rows?.[0]?.id) || null;
    if (!acct2100Id) {
      return Response.json(
        { error: "Account 2100 (Due to Landlords) not configured" },
        { status: 500 },
      );
    }

    // Opening balance: all GL movements on acct 2100 for this property before 'from'
    let openingBalance = 0;
    if (from) {
      const openingRows = await sql(
        `
          SELECT t.amount, t.debit_account_id, t.credit_account_id
          FROM transactions t
          WHERE t.property_id = $1
            AND (t.debit_account_id = $2 OR t.credit_account_id = $2)
            AND COALESCE(t.is_deleted, false) = false
            AND COALESCE(t.approval_status, 'approved') = 'approved'
            AND t.transaction_date < $3::date
        `,
        [propertyId, acct2100Id, from],
      );
      for (const r of openingRows || []) {
        const amount = Number(r.amount || 0);
        if (Number(r.credit_account_id) === acct2100Id) openingBalance += amount;
        else openingBalance -= amount;
      }
    }

    // Period transactions touching acct 2100 for this property
    const periodWhere = [
      "t.property_id = $1",
      "(t.debit_account_id = $2 OR t.credit_account_id = $2)",
      "COALESCE(t.is_deleted, false) = false",
      "COALESCE(t.approval_status, 'approved') = 'approved'",
    ];
    const periodValues = [propertyId, acct2100Id];

    if (from) {
      periodWhere.push(`t.transaction_date >= $${periodValues.length + 1}::date`);
      periodValues.push(from);
    }
    if (to) {
      periodWhere.push(`t.transaction_date <= $${periodValues.length + 1}::date`);
      periodValues.push(to);
    }

    const periodQuery = `
      SELECT
        t.id,
        t.transaction_date,
        t.description,
        t.source_type,
        t.reference_number,
        t.amount,
        t.debit_account_id,
        t.credit_account_id
      FROM transactions t
      WHERE ${periodWhere.join(" AND ")}
      ORDER BY t.transaction_date ASC, t.id ASC
    `;

    const periodRows = await sql(periodQuery, periodValues);

    let balance = openingBalance;
    let totalCredited = 0;
    let totalDebited = 0;

    const rows = [];

    // Prepend opening balance row so the running balance is visible from the first row
    if (from && openingBalance !== 0) {
      rows.push({
        id: null,
        date: from,
        description: "Opening Balance",
        source_type: "opening_balance",
        reference_number: null,
        kind: "opening",
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance,
      });
    }

    for (const t of periodRows || []) {
      const isCredit = Number(t.credit_account_id) === acct2100Id;
      const amount = Number(t.amount || 0);
      const credit = isCredit ? amount : 0;
      const debit = isCredit ? 0 : amount;
      balance += credit - debit;
      totalCredited += credit;
      totalDebited += debit;
      rows.push({
        id: Number(t.id),
        date: toDateStr(t.transaction_date),
        description: t.description || "",
        source_type: t.source_type,
        reference_number: t.reference_number || null,
        kind: isCredit ? "credit" : "debit",
        debit,
        credit,
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
      property: {
        id: Number(property.id),
        property_name: property.property_name,
        management_fee_type: property.management_fee_type,
        management_fee_percent: property.management_fee_percent,
        management_fee_fixed_amount: property.management_fee_fixed_amount,
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
    console.error("GET /api/reports/landlord-property-statement error", error);
    const includeDetails =
      process.env.NODE_ENV !== "production" && process.env.ENV !== "production";
    const details = includeDetails
      ? String(error?.message || error)
      : undefined;
    return Response.json(
      {
        error: "Failed to build landlord property statement",
        ...(details ? { details } : {}),
      },
      { status: 500 },
    );
  }
}
