import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

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

    const where = ["COALESCE(lp.is_deleted,false) = false"];
    const values = [];

    if (from) {
      where.push(`lp.payout_date >= $${values.length + 1}::date`);
      values.push(from);
    }
    if (to) {
      where.push(`lp.payout_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const whereSql = where.length ? `AND ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        l.id AS landlord_id,
        l.full_name AS landlord_name,
        COUNT(lp.id)::int AS payout_count,
        COALESCE(SUM(lp.amount), 0)::numeric AS total_paid
      FROM landlords l
      LEFT JOIN landlord_payouts lp
        ON lp.landlord_id = l.id
        ${whereSql}
      GROUP BY l.id, l.full_name
      ORDER BY l.full_name ASC
    `;

    const rows = await sql(query, values);

    const mapped = (rows || []).map((r) => ({
      landlord_id: Number(r.landlord_id),
      landlord_name: r.landlord_name,
      payout_count: Number(r.payout_count || 0),
      total_paid: Number(r.total_paid || 0),
    }));

    const totals = mapped.reduce(
      (acc, r) => {
        acc.total_paid += Number(r.total_paid || 0);
        acc.payout_count += Number(r.payout_count || 0);
        return acc;
      },
      { total_paid: 0, payout_count: 0 },
    );

    return Response.json({
      filters: { from: from || null, to: to || null },
      rows: mapped,
      totals,
    });
  } catch (error) {
    console.error("GET /api/reports/landlord-payouts error", error);
    return Response.json(
      { error: "Failed to fetch landlord payout summary" },
      { status: 500 },
    );
  }
}
