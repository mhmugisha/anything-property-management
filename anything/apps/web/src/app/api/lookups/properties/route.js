import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "dashboard");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const landlordIdRaw = (searchParams.get("landlordId") || "").trim();
    const landlordId = landlordIdRaw ? Number(landlordIdRaw) : null;

    const like = `%${search}%`;

    const rows = await sql`
      SELECT 
        p.id, 
        p.property_name, 
        p.address, 
        p.landlord_id,
        p.management_fee_type, 
        p.management_fee_percent, 
        p.management_fee_fixed_amount,
        l.full_name AS landlord_name
      FROM properties p
      LEFT JOIN landlords l ON l.id = p.landlord_id
      WHERE (
        ${search === "" ? true : false}
         OR LOWER(p.property_name) LIKE LOWER(${like})
         OR LOWER(p.address) LIKE LOWER(${like})
      )
      AND (
        ${landlordId ? false : true}
        OR p.landlord_id = ${landlordId}
      )
      ORDER BY p.property_name
      LIMIT 200
    `;

    return Response.json({ properties: rows });
  } catch (error) {
    console.error("GET /api/lookups/properties error", error);
    return Response.json(
      { error: "Failed to lookup properties" },
      { status: 500 },
    );
  }
}
