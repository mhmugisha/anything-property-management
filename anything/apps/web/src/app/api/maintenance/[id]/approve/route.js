import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

export async function POST(request, { params: { id } }) {
  const perm = await requirePermission(request, "maintenance");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const reqId = Number(id);
    if (!reqId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    // Simple admin-only control for approvals
    const isAdmin = perm.staff?.role_name === "Admin";
    if (!isAdmin) {
      return Response.json(
        { error: "Only Admin can approve expenses" },
        { status: 403 },
      );
    }

    const existingRows =
      await sql`SELECT * FROM maintenance_requests WHERE id = ${reqId} LIMIT 1`;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    const updatedRows = await sql`
      UPDATE maintenance_requests
      SET approved_by = ${perm.staff.id}, approved_at = ${nowIso}::timestamp
      WHERE id = ${reqId}
      RETURNING *
    `;

    const updated = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "maintenance.approve",
      entityType: "maintenance_request",
      entityId: reqId,
      oldValues: existing,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about maintenance approval
    // Get property details for notification
    if (updated?.id && updated?.property_id) {
      const propertyRows = await sql`
        SELECT property_name FROM properties WHERE id = ${updated.property_id} LIMIT 1
      `;
      const propertyName = propertyRows?.[0]?.property_name || "Property";

      notifyAllAdminsAsync({
        title: "Maintenance Request Approved",
        message: `Maintenance request approved: ${updated.title} at ${propertyName}${updated.cost ? ` - UGX ${Number(updated.cost).toLocaleString()}` : ""}. Approved by ${perm.staff.full_name || "Staff"}`,
        type: "maintenance",
        reference_id: updated.id,
        reference_type: "maintenance_request",
      });
    }

    return Response.json({ request: updated });
  } catch (error) {
    console.error("POST /api/maintenance/[id]/approve error", error);
    return Response.json({ error: "Failed to approve" }, { status: 500 });
  }
}
