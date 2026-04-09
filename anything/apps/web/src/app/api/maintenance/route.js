import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function GET(request) {
  const perm = await requirePermission(request, "maintenance");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const requests = await sql`
      SELECT m.*, p.property_name, u.unit_number, t.full_name AS tenant_name
      FROM maintenance_requests m
      LEFT JOIN properties p ON m.property_id = p.id
      LEFT JOIN units u ON m.unit_id = u.id
      LEFT JOIN tenants t ON m.tenant_id = t.id
      ORDER BY m.created_at DESC
      LIMIT 300
    `;

    return Response.json({ requests });
  } catch (error) {
    console.error("GET /api/maintenance error", error);
    return Response.json(
      { error: "Failed to fetch maintenance requests" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "maintenance");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const title = (body?.title || "").trim();
    const description = (body?.description || "").trim() || null;
    const category = (body?.category || "").trim() || null;
    const priority = (body?.priority || "medium").trim();
    const status = (body?.status || "pending").trim();

    const unitId = toNumber(body?.unit_id);
    const propertyId = toNumber(body?.property_id);
    const tenantId = toNumber(body?.tenant_id);

    const assignedTo = (body?.assigned_to || "").trim() || null;
    const cost = toNumber(body?.cost);

    const approvalThreshold = 500000;
    const approvalRequired = cost !== null && cost > approvalThreshold;

    if (!title) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO maintenance_requests (
        unit_id, property_id, tenant_id,
        title, description, category,
        priority, status,
        assigned_to, cost,
        approval_required,
        created_by
      )
      VALUES (
        ${unitId}, ${propertyId}, ${tenantId},
        ${title}, ${description}, ${category},
        ${priority}, ${status},
        ${assignedTo}, ${cost},
        ${approvalRequired},
        ${perm.staff.id}
      )
      RETURNING *
    `;

    const reqRow = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "maintenance.create",
      entityType: "maintenance_request",
      entityId: reqRow?.id || null,
      oldValues: null,
      newValues: reqRow,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about new maintenance request
    // Get property name for notification
    if (reqRow?.id && propertyId) {
      const propertyRows = await sql`
        SELECT property_name FROM properties WHERE id = ${propertyId} LIMIT 1
      `;
      const propertyName = propertyRows?.[0]?.property_name || "Property";

      notifyAllAdminsAsync({
        title: "New Maintenance Request",
        message: `New maintenance request: ${title} at ${propertyName}${approvalRequired ? " (Approval Required)" : ""}. Created by ${perm.staff.full_name || "Staff"}`,
        type: "maintenance",
        reference_id: reqRow.id,
        reference_type: "maintenance_request",
      });
    }

    return Response.json({ request: reqRow });
  } catch (error) {
    console.error("POST /api/maintenance error", error);
    return Response.json(
      { error: "Failed to create maintenance request" },
      { status: 500 },
    );
  }
}
