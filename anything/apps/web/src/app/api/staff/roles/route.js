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

export async function GET() {
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
