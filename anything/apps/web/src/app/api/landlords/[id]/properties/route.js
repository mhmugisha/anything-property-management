import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const properties = await sql`
      SELECT id, property_name, address, property_type,
             management_fee_type, management_fee_percent, management_fee_fixed_amount,
             landlord_id
      FROM properties
      WHERE landlord_id = ${landlordId}
      ORDER BY property_name
      LIMIT 500
    `;

    return Response.json({ properties });
  } catch (error) {
    console.error("GET /api/landlords/[id]/properties error", error);
    return Response.json(
      { error: "Failed to fetch properties" },
      { status: 500 },
    );
  }
}
