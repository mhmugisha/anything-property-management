import sql from "@/app/api/utils/sql";

/**
 * Active leases on a landlord's properties — the same rule Close Landlord
 * and property decommission gate on.
 */
export async function countActiveLeasesForLandlord(landlordId) {
  const rows = await sql`
    SELECT COUNT(*)::int AS c
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN properties p ON p.id = u.property_id
    WHERE p.landlord_id = ${landlordId} AND l.status = 'active'
  `;
  return Number(rows?.[0]?.c || 0);
}
