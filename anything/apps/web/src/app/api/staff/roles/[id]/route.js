import sql from "@/app/api/utils/sql";
import { getStaffContext, writeAuditLog } from "@/app/api/utils/staff";

async function requireAdmin(request) {
  const { session, staff, ipAddress } = await getStaffContext(request);

  if (!session) {
    return {
      ok: false,
      status: 401,
      body: { error: "Unauthorized" },
      staff: null,
      ipAddress,
    };
  }

  if (!staff || staff.is_active === false) {
    return {
      ok: false,
      status: 403,
      body: { error: "Staff profile not set up" },
      staff: null,
      ipAddress,
    };
  }

  if (staff.role_name !== "Admin") {
    return {
      ok: false,
      status: 403,
      body: { error: "Forbidden" },
      staff,
      ipAddress,
    };
  }

  return { ok: true, status: 200, body: null, staff, ipAddress };
}

export async function PUT(request, { params: { id } }) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  const roleId = Number(id);
  if (!roleId || !Number.isFinite(roleId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const oldRows = await sql`
      SELECT id, role_name, permissions
      FROM user_roles
      WHERE id = ${roleId}
      LIMIT 1
    `;

    const oldRole = oldRows?.[0] || null;
    if (!oldRole) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    const roleName =
      typeof body?.role_name === "string" ? body.role_name.trim() : null;

    const permissions =
      body?.permissions && typeof body.permissions === "object"
        ? body.permissions
        : null;

    if (oldRole.role_name === "Admin") {
      if (roleName && roleName !== "Admin") {
        return Response.json(
          { error: "Admin role cannot be renamed" },
          { status: 400 },
        );
      }
    }

    if (roleName !== null && !roleName) {
      return Response.json({ error: "Role name is required" }, { status: 400 });
    }

    // Check unique name if changing
    if (roleName && roleName !== oldRole.role_name) {
      const existing = await sql`
        SELECT id
        FROM user_roles
        WHERE role_name = ${roleName}
          AND id <> ${roleId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        return Response.json(
          { error: "A role with this name already exists" },
          { status: 409 },
        );
      }
    }

    if (roleName === null && permissions === null) {
      return Response.json({ role: oldRole });
    }

    if (roleName !== null && permissions !== null) {
      await sql`
        UPDATE user_roles
        SET role_name = ${roleName}, permissions = ${JSON.stringify(permissions)}::jsonb
        WHERE id = ${roleId}
      `;
    } else if (roleName !== null) {
      await sql`
        UPDATE user_roles
        SET role_name = ${roleName}
        WHERE id = ${roleId}
      `;
    } else if (permissions !== null) {
      await sql`
        UPDATE user_roles
        SET permissions = ${JSON.stringify(permissions)}::jsonb
        WHERE id = ${roleId}
      `;
    }

    const newRows = await sql`
      SELECT id, role_name, permissions
      FROM user_roles
      WHERE id = ${roleId}
      LIMIT 1
    `;

    const newRole = newRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "role_update",
      entityType: "user_role",
      entityId: roleId,
      oldValues: oldRole,
      newValues: newRole,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ role: newRole });
  } catch (error) {
    console.error("Error updating role:", error);
    return Response.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  const roleId = Number(id);
  if (!roleId || !Number.isFinite(roleId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const oldRows = await sql`
      SELECT id, role_name, permissions
      FROM user_roles
      WHERE id = ${roleId}
      LIMIT 1
    `;

    const oldRole = oldRows?.[0] || null;
    if (!oldRole) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (oldRole.role_name === "Admin") {
      return Response.json(
        { error: "Admin role cannot be deleted" },
        { status: 400 },
      );
    }

    const inUseRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM staff_users
      WHERE role_id = ${roleId}
    `;

    const inUseCount = Number(inUseRows?.[0]?.count || 0);
    if (inUseCount > 0) {
      return Response.json(
        {
          error: "Role is in use",
          detail: "Assign those staff users to another role first.",
        },
        { status: 409 },
      );
    }

    await sql`
      DELETE FROM user_roles
      WHERE id = ${roleId}
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "role_delete",
      entityType: "user_role",
      entityId: roleId,
      oldValues: oldRole,
      newValues: null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return Response.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
