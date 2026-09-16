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

function getReportsAllowed(permissions) {
  if (!permissions || typeof permissions !== "object") return [];
  const list = permissions.reports_allowed;
  if (!Array.isArray(list)) return [];
  return list.map((v) => String(v));
}

/**
 * Passes if the caller has the blanket "reports" permission OR the
 * given reportKey is present in permissions.reports_allowed. Used to
 * expose a specific report to a role that otherwise lacks reports.
 */
export async function requireReportAccess(request, reportKey) {
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

  const hasReports = hasPermission(permissions, "reports");
  const allowedList = getReportsAllowed(permissions);
  const key = String(reportKey || "");

  if (!hasReports && !(key && allowedList.includes(key))) {
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

/**
 * Passes if the caller has the given blanket permission OR is a
 * Portfolio Manager. Used to expose narrow capabilities (e.g. payment
 * promises) to managers without granting the full "tenants" permission.
 */
export async function requirePermissionOrManager(request, key) {
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

  const isManager = staff.role_name === "Portfolio Manager";
  if (!hasPermission(permissions, key) && !isManager) {
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
