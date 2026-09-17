import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) {
    return Response.json(perm.body, { status: perm.status });
  }

  try {
    const rows = await sql`
      SELECT
        p.id,
        p.property_name,
        p.address,
        p.landlord_id,
        l.title AS landlord_title,
        l.full_name AS landlord_full_name
      FROM properties p
      LEFT JOIN landlords l ON l.id = p.landlord_id
      ORDER BY p.property_name ASC
      LIMIT 500
    `;

    return Response.json({ properties: rows || [] });
  } catch (error) {
    console.error("GET /api/tenants/properties error", error);
    return Response.json(
      { error: "Failed to fetch properties" },
      { status: 500 },
    );
  }
}
