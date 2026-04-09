import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  // This is used when assigning a lease.
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const includeUnitIdRaw = (searchParams.get("includeUnitId") || "").trim();
    const includeUnitId = includeUnitIdRaw ? Number(includeUnitIdRaw) : null;

    const units = await sql`
      SELECT 
        u.id, 
        u.unit_number, 
        u.status, 
        u.property_id, 
        u.monthly_rent_ugx,
        u.monthly_rent_usd,
        p.property_name,
        p.landlord_id
      FROM units u
      LEFT JOIN properties p ON u.property_id = p.id
      WHERE (
            -- Prefer a truthy definition of "vacant": no active lease.
            -- Also require the unit is attached to a property, otherwise it can't be leased.
            NOT EXISTS (
              SELECT 1
              FROM leases l
              WHERE l.unit_id = u.id
                AND l.status = 'active'
            )
            AND u.property_id IS NOT NULL
          )
         OR (${includeUnitId}::int IS NOT NULL AND u.id = ${includeUnitId})
      ORDER BY p.property_name, u.id
      LIMIT 2000
    `;

    return Response.json({ units });
  } catch (error) {
    console.error("GET /api/units/vacant error", error);
    return Response.json({ error: "Failed to fetch units" }, { status: 500 });
  }
}
