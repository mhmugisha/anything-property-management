import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "maintenance");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const reqId = Number(id);
    if (!reqId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows =
      await sql`SELECT * FROM maintenance_requests WHERE id = ${reqId} LIMIT 1`;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    const title =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    const description =
      typeof body?.description === "string"
        ? body.description.trim()
        : undefined;
    const category =
      typeof body?.category === "string" ? body.category.trim() : undefined;
    const priority =
      typeof body?.priority === "string" ? body.priority.trim() : undefined;
    const status =
      typeof body?.status === "string" ? body.status.trim() : undefined;
    const assignedTo =
      typeof body?.assigned_to === "string"
        ? body.assigned_to.trim()
        : undefined;
    const cost = body?.cost !== undefined ? toNumber(body.cost) : undefined;

    const approvalThreshold = 500000;
    const nextCost = cost !== undefined ? cost : existing.cost;
    const approvalRequired =
      nextCost !== null &&
      nextCost !== undefined &&
      Number(nextCost) > approvalThreshold;

    const completedAt =
      status === "completed" && !existing.completed_at
        ? new Date().toISOString()
        : existing.completed_at;

    const updatedRows = await sql`
      UPDATE maintenance_requests
      SET
        title = ${title !== undefined ? title : existing.title},
        description = ${description !== undefined ? description || null : existing.description},
        category = ${category !== undefined ? category || null : existing.category},
        priority = ${priority !== undefined ? priority : existing.priority},
        status = ${status !== undefined ? status : existing.status},
        assigned_to = ${assignedTo !== undefined ? assignedTo || null : existing.assigned_to},
        cost = ${cost !== undefined ? cost : existing.cost},
        approval_required = ${approvalRequired},
        completed_at = ${completedAt ? completedAt : null}
      WHERE id = ${reqId}
      RETURNING *
    `;

    const updated = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "maintenance.update",
      entityType: "maintenance_request",
      entityId: reqId,
      oldValues: existing,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ request: updated });
  } catch (error) {
    console.error("PUT /api/maintenance/[id] error", error);
    return Response.json(
      { error: "Failed to update maintenance request" },
      { status: 500 },
    );
  }
}
