import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

// Un-archive a decommissioned property. Invoicing resumes through the normal
// generator for any lease created on it afterwards; ended leases stay ended.
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

    const results = await sql.transaction([
      sql(`SELECT id FROM properties WHERE id = $1 FOR UPDATE`, [propertyId]),
      sql(
        `UPDATE properties
         SET is_deleted = false
         WHERE id = $1 AND is_deleted = true
         RETURNING id`,
        [propertyId],
      ),
    ]);

    const reactivatedRows = results[results.length - 1];
    if (!reactivatedRows?.length) {
      return Response.json(
        { error: "Property is not archived" },
        { status: 409 },
      );
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "property.reactivate",
      entityType: "properties",
      entityId: propertyId,
      oldValues: existing,
      newValues: { ...existing, is_deleted: false },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true, property_id: propertyId });
  } catch (error) {
    console.error("POST /api/properties/[id]/reactivate error", error);
    return Response.json(
      { error: "Failed to reactivate property" },
      { status: 500 },
    );
  }
}
