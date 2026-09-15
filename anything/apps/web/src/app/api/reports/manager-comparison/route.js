import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

/**
 * Manager Comparison Report
 *
 * One row per Portfolio Manager comparing collection performance over a
 * chosen invoice_date range.
 *
 * Reuses the same unpaid-invoice / per-manager aggregation as
 * /api/reports/manager-arrears so totals tie out exactly:
 *   included when (amount - paid_amount) > 0
 *              AND status <> 'void'
 *              AND COALESCE(is_deleted, false) = false
 *              AND COALESCE(approval_status, 'approved') = 'approved'
 *              AND lease is active
 *
 * From/To dates filter on i.invoice_date, matching Manager Arrears.
 *
 * Query params:
 *   fromDate  YYYY-MM-DD (optional)
 *   toDate    YYYY-MM-DD (optional)
 */
export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = (searchParams.get("fromDate") || "").trim() || null;
    const toDate = (searchParams.get("toDate") || "").trim() || null;

    const conditions = [
      "(i.amount - i.paid_amount) > 0",
      "i.status <> 'void'",
      "COALESCE(i.is_deleted, false) = false",
      "COALESCE(i.approval_status, 'approved') = 'approved'",
      "EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id AND l.status = 'active')",
    ];
    const values = [];

    if (fromDate) {
      values.push(fromDate);
      conditions.push(`i.invoice_date >= $${values.length}`);
    }
    if (toDate) {
      values.push(toDate);
      conditions.push(`i.invoice_date <= $${values.length}`);
    }

    const query = `
      SELECT
        p.assigned_officer_id,
        so.full_name AS officer_name,
        COUNT(DISTINCT i.property_id)::int AS property_count,
        COUNT(DISTINCT i.tenant_id)::int   AS tenant_count,
        COALESCE(SUM(i.amount), 0)         AS total_rent,
        COALESCE(SUM(i.paid_amount), 0)    AS recovered,
        COALESCE(SUM(i.amount - i.paid_amount), 0) AS balance
      FROM invoices i
      LEFT JOIN properties p ON p.id = i.property_id
      LEFT JOIN staff_users so ON so.id = p.assigned_officer_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY p.assigned_officer_id, so.full_name
    `;

    const rows = await sql(query, values);

    let totalRent = 0;
    let totalRecovered = 0;
    let totalBalance = 0;

    const managers = rows.map((r) => {
      const officerIdVal =
        r.assigned_officer_id === null || r.assigned_officer_id === undefined
          ? null
          : Number(r.assigned_officer_id);
      const total_rent = Number(r.total_rent || 0);
      const recovered = Number(r.recovered || 0);
      const balance = Number(r.balance || 0);
      const recovery_rate = total_rent > 0 ? (recovered / total_rent) * 100 : 0;

      totalRent += total_rent;
      totalRecovered += recovered;
      totalBalance += balance;

      return {
        officer_id: officerIdVal,
        officer_name: r.officer_name || "Unassigned",
        property_count: Number(r.property_count || 0),
        tenant_count: Number(r.tenant_count || 0),
        total_rent,
        recovered,
        balance,
        recovery_rate,
      };
    });

    managers.sort((a, b) => b.recovery_rate - a.recovery_rate);

    const totals = {
      total_rent: totalRent,
      recovered: totalRecovered,
      balance: totalBalance,
      recovery_rate: totalRent > 0 ? (totalRecovered / totalRent) * 100 : 0,
    };

    return Response.json({
      from: fromDate,
      to: toDate,
      managers,
      totals,
    });
  } catch (error) {
    console.error("GET /api/reports/manager-comparison error", error);
    return Response.json(
      { error: "Failed to build manager comparison report" },
      { status: 500 },
    );
  }
}
