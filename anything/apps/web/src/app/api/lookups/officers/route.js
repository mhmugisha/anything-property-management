import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const rows = await sql`
      SELECT su.id, su.full_name, su.email, su.phone
      FROM staff_users su
      JOIN user_roles ur ON ur.id = su.role_id
      WHERE ur.role_name = 'Collection Officer'
        AND COALESCE(su.is_active, true) = true
      ORDER BY su.full_name ASC
    `;
    return Response.json({ officers: rows || [] });
  } catch (error) {
    console.error("GET /api/lookups/officers error", error);
    return Response.json(
      { error: "Failed to fetch officers" },
      { status: 500 }
    );
  }
}
