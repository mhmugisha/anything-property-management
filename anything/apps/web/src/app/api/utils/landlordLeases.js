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

/**
 * The landlord's live (not archived / decommissioned) properties. Closing a
 * landlord requires every property to be decommissioned first.
 */
export async function countLivePropertiesForLandlord(landlordId) {
  const rows = await sql`
    SELECT COUNT(*)::int AS c
    FROM properties
    WHERE landlord_id = ${landlordId}
      AND COALESCE(is_deleted, false) = false
  `;
  return Number(rows?.[0]?.c || 0);
}
