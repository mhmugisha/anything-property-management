import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function getIpAddress(request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim());
      if (parts.length > 0) return parts[0];
    }
    const realIp = request.headers.get("x-real-ip");
    return realIp || null;
  } catch {
    return null;
  }
}

export async function getStaffContext(request) {
  const session = await auth();
  if (!session || !session.user?.email) {
    return { session: null, staff: null, permissions: null, ipAddress: null };
  }

  const email = session.user.email;
  const rows = await sql`
    SELECT s.id, s.email, s.full_name, s.role_id, s.is_active,
           r.role_name, r.permissions
    FROM staff_users s
    LEFT JOIN user_roles r ON s.role_id = r.id
    WHERE s.email = ${email}
    LIMIT 1
  `;

  const staff = rows?.[0] || null;
  const permissions = staff?.permissions || null;
  const ipAddress = getIpAddress(request);

  return { session, staff, permissions, ipAddress };
}

export function hasPermission(permissions, key) {
  if (!permissions || typeof permissions !== "object") return false;
  return permissions[key] === true;
}

export async function requirePermission(request, key) {
  const { session, staff, permissions, ipAddress } =
    await getStaffContext(request);

  if (!session) {
    return {
      ok: false,
      status: 401,
      body: { error: "Unauthorized" },
      staff: null,
      permissions: null,
      ipAddress,
    };
  }

  if (!staff || staff.is_active === false) {
    return {
      ok: false,
      status: 403,
      body: { error: "Staff profile not set up" },
      staff: null,
      permissions: null,
      ipAddress,
    };
  }

  if (!hasPermission(permissions, key)) {
    return {
      ok: false,
      status: 403,
      body: { error: "Forbidden" },
      staff,
      permissions,
      ipAddress,
    };
  }

  return { ok: true, status: 200, body: null, staff, permissions, ipAddress };
}

export async function writeAuditLog({
  staffId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  ipAddress,
}) {
  await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
    VALUES (
      ${staffId},
      ${action},
      ${entityType || null},
      ${entityId || null},
      ${oldValues ? JSON.stringify(oldValues) : null}::jsonb,
      ${newValues ? JSON.stringify(newValues) : null}::jsonb,
      ${ipAddress || null}
    )
  `;
}
