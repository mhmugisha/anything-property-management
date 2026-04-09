import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request, { params }) {
  // This endpoint is used by the Tenants page to let a user pick a property
  // after selecting a landlord.
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) {
    return Response.json(perm.body, { status: perm.status });
  }

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const properties = await sql`
      SELECT id, property_name, address, landlord_id
      FROM properties
      WHERE landlord_id = ${landlordId}
      ORDER BY property_name
      LIMIT 500
    `;

    return Response.json({ properties });
  } catch (error) {
    console.error("GET /api/tenants/landlord-properties/[id] error", error);
    return Response.json(
      { error: "Failed to fetch landlord properties" },
      { status: 500 },
    );
  }
}
