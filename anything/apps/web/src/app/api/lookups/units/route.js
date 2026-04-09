import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "dashboard");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = Number(searchParams.get("propertyId"));

    if (!propertyId) {
      return Response.json({ units: [] });
    }

    const rows = await sql`
      SELECT 
        u.id, 
        u.unit_number, 
        u.status,
        l.tenant_id
      FROM units u
      LEFT JOIN leases l ON l.unit_id = u.id AND l.status = 'active'
      WHERE u.property_id = ${propertyId}
      ORDER BY u.id
      LIMIT 200
    `;

    return Response.json({ units: rows });
  } catch (error) {
    console.error("GET /api/lookups/units error", error);
    return Response.json({ error: "Failed to lookup units" }, { status: 500 });
  }
}
