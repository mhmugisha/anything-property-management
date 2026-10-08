import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

// Archive a property once all its leases are cleared. Archived properties are
// skipped by the invoice generator and can't take new leases; reactivate
// reverses this.
export async function POST(request, { params: { id } }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const propertyId = parseInt(id, 10);
    if (!Number.isFinite(propertyId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows = await sql`
      SELECT id, property_name, landlord_id,
             COALESCE(is_deleted, false) AS is_deleted
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // One atomic transaction: lock the property, then archive only if it is
    // still live and has no active lease at the moment of the write.
    const results = await sql.transaction([
      sql(`SELECT id FROM properties WHERE id = $1 FOR UPDATE`, [propertyId]),
      sql(
        `UPDATE properties
         SET is_deleted = true
         WHERE id = $1
           AND COALESCE(is_deleted, false) = false
           AND NOT EXISTS (
             SELECT 1
             FROM leases l
             JOIN units u ON u.id = l.unit_id
             WHERE u.property_id = $1 AND l.status = 'active'
           )
         RETURNING id`,
        [propertyId],
      ),
    ]);

    const archivedRows = results[results.length - 1];
    if (!archivedRows?.length) {
      const activeRows = await sql`
        SELECT COUNT(*)::int AS c
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        WHERE u.property_id = ${propertyId} AND l.status = 'active'
      `;
      const activeCount = Number(activeRows?.[0]?.c || 0);
      if (activeCount > 0) {
        return Response.json(
          {
            error: `This property still has ${activeCount} active lease(s). End them before decommissioning.`,
            active_lease_count: activeCount,
          },
          { status: 409 },
        );
      }
      return Response.json(
        { error: "Property is already archived" },
        { status: 409 },
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "property.decommission",
      entityType: "properties",
      entityId: propertyId,
      oldValues: existing,
      newValues: { ...existing, is_deleted: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true, property_id: propertyId });
  } catch (error) {
    console.error("POST /api/properties/[id]/decommission error", error);
    return Response.json(
      { error: "Failed to decommission property" },
      { status: 500 },
    );
  }
}
