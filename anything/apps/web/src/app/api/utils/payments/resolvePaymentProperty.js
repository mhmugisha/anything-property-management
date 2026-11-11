import sql from "@/app/api/utils/sql";

/**
 * Decide which property a tenant-level payment (Payment on Account, Allocate
 * from Holding) belongs to. Credit is scoped per property, so the server never
 * guesses between properties:
 *
 *  - property_id given          -> used as is (recordAdvancePayment then
 *                                  requires an active/ended lease there);
 *  - missing, one candidate      -> that property;
 *  - missing, several candidates -> 400, the user must choose;
 *  - missing, none               -> 400.
 *
 * Candidates are the properties of the tenant's ACTIVE leases; only when there
 * are none, the properties of their ENDED leases (recordAdvancePayment accepts
 * either).
 *
 * @returns {Promise<{ ok: true, propertyId: number } |
 *                   { ok: false, status: number, body: object }>}
 */
export async function resolvePaymentProperty({ tenantId, propertyId }) {
  if (propertyId) return { ok: true, propertyId: Number(propertyId) };

  const rows = await sql`
    SELECT DISTINCT u.property_id, p.property_name, l.status
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN properties p ON p.id = u.property_id
    WHERE l.tenant_id = ${tenantId}
      AND l.status IN ('active', 'ended')
  `;

  const active = (rows || []).filter((r) => r.status === "active");
  const pool = active.length > 0 ? active : rows || [];
  const byId = new Map();
  for (const r of pool) {
    byId.set(Number(r.property_id), r.property_name || null);
  }

  if (byId.size === 1) {
    return { ok: true, propertyId: [...byId.keys()][0] };
  }

  if (byId.size === 0) {
    return {
      ok: false,
      status: 400,
      body: { error: "No active or ended lease found for this tenant" },
    };
  }

  return {
    ok: false,
    status: 400,
    body: {
      error:
        "This tenant has leases at more than one property. Choose the property this payment belongs to.",
      property_required: true,
      properties: [...byId.entries()].map(([id, name]) => ({
        property_id: id,
        property_name: name,
      })),
    },
  };
}
