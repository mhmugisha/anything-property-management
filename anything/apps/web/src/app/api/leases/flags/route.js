import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const flags = await sql`
      SELECT
        f.id,
        f.lease_id,
        f.reason,
        f.reason_detail,
        f.raised_at,
        l.status        AS lease_status,
        l.end_date      AS lease_end_date,
        l.monthly_rent,
        t.id            AS tenant_id,
        t.title         AS tenant_title,
        t.full_name     AS tenant_name,
        t.phone         AS tenant_phone,
        u.id            AS unit_id,
        u.unit_number,
        p.id            AS property_id,
        p.property_name,
        ld.id           AS landlord_id,
        ld.full_name    AS landlord_name
      FROM lease_review_flags f
      JOIN leases     l  ON l.id  = f.lease_id
      JOIN tenants    t  ON t.id  = l.tenant_id
      JOIN units      u  ON u.id  = l.unit_id
      JOIN properties p  ON p.id  = u.property_id
      JOIN landlords  ld ON ld.id = p.landlord_id
      WHERE f.resolved_at IS NULL
      ORDER BY f.raised_at DESC
    `;

    return Response.json({ flags: flags || [] });
  } catch (error) {
    console.error("GET /api/leases/flags error", error);
    return Response.json({ error: "Failed to fetch lease flags" }, { status: 500 });
  }
}
