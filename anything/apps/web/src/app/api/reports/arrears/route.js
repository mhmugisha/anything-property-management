import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const rows = await sql`
      WITH unpaid AS (
        SELECT
          i.lease_id,
          i.tenant_id,
          i.property_id,
          i.unit_id,
          i.due_date,
          (i.amount - i.paid_amount) AS outstanding
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.due_date < CURRENT_DATE
      )
      SELECT
        u.lease_id,
        t.id AS tenant_id,
        t.full_name AS tenant_name,
        pr.property_name,
        un.unit_number,
        COUNT(*)::int AS months_behind,
        COALESCE(SUM(u.outstanding), 0) AS arrears_amount,
        (CURRENT_DATE - MIN(u.due_date))::int AS days_overdue
      FROM unpaid u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN properties pr ON pr.id = u.property_id
      LEFT JOIN units un ON un.id = u.unit_id
      GROUP BY u.lease_id, t.id, pr.property_name, un.unit_number
      ORDER BY 
        pr.property_name,
        (CASE WHEN un.unit_number ~ '^\d+$' THEN un.unit_number::integer ELSE 999999 END),
        un.unit_number
      LIMIT 5000
    `;

    const mapped = rows.map((r) => {
      const days = Number(r.days_overdue || 0);

      let bucket = "0";
      if (days >= 90) bucket = "90+";
      else if (days >= 60) bucket = "60";
      else if (days >= 30) bucket = "30";

      return {
        lease_id: r.lease_id,
        tenant_id: r.tenant_id,
        tenant_name: r.tenant_name,
        property_name: r.property_name,
        unit_number: r.unit_number,
        months_behind: Number(r.months_behind || 0),
        arrears_amount: Number(r.arrears_amount || 0),
        bucket,
      };
    });

    return Response.json({ rows: mapped });
  } catch (error) {
    console.error("GET /api/reports/arrears error", error);
    return Response.json(
      { error: "Failed to build arrears report" },
      { status: 500 },
    );
  }
}
