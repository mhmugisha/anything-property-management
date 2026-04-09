import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  // Basic lookup used by Payments/Reports/Maintenance forms.
  const perm = await requirePermission(request, "dashboard");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const landlordIdRaw = (searchParams.get("landlordId") || "").trim();
    const landlordId = landlordIdRaw ? Number(landlordIdRaw) : null;
    const propertyIdRaw = (searchParams.get("propertyId") || "").trim();
    const propertyId = propertyIdRaw ? Number(propertyIdRaw) : null;

    const like = `%${search}%`;

    const rows = await sql`
      SELECT
        t.id,
        t.title,
        t.full_name,
        t.phone,
        t.email,
        cl.property_id AS current_property_id,
        p.property_name AS current_property_name,
        cl.unit_id AS current_unit_id,
        cl.unit_number AS current_unit_number,
        p.landlord_id AS current_landlord_id
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT
          l.id AS lease_id,
          u.property_id,
          u.id AS unit_id,
          u.unit_number
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        WHERE l.tenant_id = t.id
          AND l.status = 'active'
        ORDER BY l.start_date DESC
        LIMIT 1
      ) cl ON true
      LEFT JOIN properties p ON p.id = cl.property_id
      WHERE COALESCE(t.status, 'active') <> 'archived'
        AND (
          ${search === "" ? true : false}
          OR LOWER(t.full_name) LIKE LOWER(${like})
          OR t.phone LIKE ${like}
          OR LOWER(COALESCE(t.email,'')) LIKE LOWER(${like})
        )
        AND (
          ${landlordId ? false : true}
          OR p.landlord_id = ${landlordId}
        )
        AND (
          ${propertyId ? false : true}
          OR p.id = ${propertyId}
        )
      ORDER BY t.full_name
      LIMIT 500
    `;

    return Response.json({ tenants: rows });
  } catch (error) {
    console.error("GET /api/lookups/tenants error", error);
    return Response.json(
      { error: "Failed to lookup tenants" },
      { status: 500 },
    );
  }
}
