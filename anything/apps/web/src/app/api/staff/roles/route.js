import sql from "@/app/api/utils/sql";
import { requireAdmin, writeAuditLog } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const roles = await sql`
      SELECT id, role_name, permissions 
      FROM user_roles 
      ORDER BY role_name
    `;

    return Response.json({ roles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return Response.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const roleName =
      typeof body?.role_name === "string" ? body.role_name.trim() : "";

    const permissions =
      body?.permissions && typeof body.permissions === "object"
        ? body.permissions
        : {};

    if (!roleName) {
      return Response.json({ error: "Role name is required" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id
      FROM user_roles
      WHERE role_name = ${roleName}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return Response.json(
        { error: "A role with this name already exists" },
        { status: 409 },
      );
    }

    const inserted = await sql`
      INSERT INTO user_roles (role_name, permissions)
      VALUES (${roleName}, ${JSON.stringify(permissions)}::jsonb)
      RETURNING id
    `;

    const insertedId = inserted?.[0]?.id || null;

    const created = await sql`
      SELECT id, role_name, permissions
      FROM user_roles
      WHERE id = ${insertedId}
      LIMIT 1
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "role_create",
      entityType: "user_role",
      entityId: insertedId,
      oldValues: null,
      newValues: created?.[0] || null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ role: created?.[0] || null });
  } catch (error) {
    console.error("Error creating role:", error);
    return Response.json({ error: "Failed to create role" }, { status: 500 });
  }
}
