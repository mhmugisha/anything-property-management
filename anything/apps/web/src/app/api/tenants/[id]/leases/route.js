import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tenantId = Number(id);
    if (!tenantId) {
      return Response.json({ error: "Invalid tenant id" }, { status: 400 });
    }

    const leases = await sql`
      SELECT 
        l.*, 
        u.unit_number, 
        u.property_id,
        p.property_name,
        p.landlord_id
      FROM leases l
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN properties p ON u.property_id = p.id
      WHERE l.tenant_id = ${tenantId}
      ORDER BY l.start_date DESC
      LIMIT 50
    `;

    return Response.json({ leases });
  } catch (error) {
    console.error("GET /api/tenants/[id]/leases error", error);
    return Response.json({ error: "Failed to fetch leases" }, { status: 500 });
  }
}
