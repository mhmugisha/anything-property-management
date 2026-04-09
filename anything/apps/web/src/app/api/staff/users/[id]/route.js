import sql from "@/app/api/utils/sql";
import { getStaffContext, writeAuditLog } from "@/app/api/utils/staff";
import { hash } from "argon2";

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

  const staffIdToUpdate = Number(id);
  if (!staffIdToUpdate || !Number.isFinite(staffIdToUpdate)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const oldRows = await sql`
      SELECT s.id, s.email, s.full_name, s.phone, s.role_id, s.is_active,
             r.role_name
      FROM staff_users s
      LEFT JOIN user_roles r ON r.id = s.role_id
      WHERE s.id = ${staffIdToUpdate}
      LIMIT 1
    `;

    const oldUser = oldRows?.[0] || null;
    if (!oldUser) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    const updates = [];
    const values = [];
    let idx = 1;

    const fullName =
      typeof body?.full_name === "string" ? body.full_name.trim() : null;
    const phone = typeof body?.phone === "string" ? body.phone.trim() : null;

    const roleId =
      body?.role_id !== undefined && body?.role_id !== null
        ? Number(body.role_id)
        : null;

    const isActive =
      body?.is_active !== undefined && body?.is_active !== null
        ? Boolean(body.is_active)
        : null;

    const newPassword =
      typeof body?.password === "string" ? body.password.trim() : "";

    if (fullName !== null) {
      updates.push(`full_name = $${idx++}`);
      values.push(fullName);
    }

    if (phone !== null) {
      updates.push(`phone = $${idx++}`);
      values.push(phone || null);
    }

    if (roleId !== null) {
      if (!Number.isFinite(roleId) || roleId <= 0) {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }

      // Prevent promoting any user to Admin role
      const adminRoleRows =
        await sql`SELECT id FROM user_roles WHERE role_name = 'Admin' LIMIT 1`;
      const adminRoleId = adminRoleRows?.[0]?.id || null;

      if (
        adminRoleId &&
        roleId === adminRoleId &&
        oldUser.role_name !== "Admin"
      ) {
        return Response.json(
          { error: "Users cannot be promoted to Admin role." },
          { status: 403 },
        );
      }

      updates.push(`role_id = $${idx++}`);
      values.push(roleId);
    }

    if (isActive !== null) {
      // Prevent an admin from locking themselves out.
      if (oldUser.email === perm.staff.email && isActive === false) {
        return Response.json(
          { error: "You cannot deactivate your own account" },
          { status: 400 },
        );
      }
      updates.push(`is_active = $${idx++}`);
      values.push(isActive);
    }

    // Handle password change
    if (newPassword) {
      if (newPassword.length < 6) {
        return Response.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }

      const hashedPassword = await hash(newPassword);
      const staffEmail = oldUser.email;

      // Find the auth_users record for this staff email
      const authUserRows =
        await sql`SELECT id FROM auth_users WHERE email = ${staffEmail} LIMIT 1`;

      if (authUserRows.length > 0) {
        const authUserId = authUserRows[0].id;

        // Check if credentials account exists
        const existingAccount = await sql(
          `SELECT id FROM auth_accounts WHERE "userId" = $1 AND provider = 'credentials' LIMIT 1`,
          [authUserId],
        );

        if (existingAccount.length > 0) {
          await sql(
            `UPDATE auth_accounts SET password = $1 WHERE "userId" = $2 AND provider = 'credentials'`,
            [hashedPassword, authUserId],
          );
        } else {
          await sql(
            `INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password) VALUES ($1, 'credentials', 'credentials', $2, $3)`,
            [authUserId, String(authUserId), hashedPassword],
          );
        }
      } else {
        // No auth_users record — create one so they can sign in
        const authInserted = await sql`
          INSERT INTO auth_users (name, email)
          VALUES (${oldUser.full_name || staffEmail}, ${staffEmail})
          RETURNING id
        `;
        const newAuthId = authInserted?.[0]?.id || null;
        if (newAuthId) {
          await sql(
            `INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password) VALUES ($1, 'credentials', 'credentials', $2, $3)`,
            [newAuthId, String(newAuthId), hashedPassword],
          );
        }
      }

      await writeAuditLog({
        staffId: perm.staff.id,
        action: "staff_user_password_set",
        entityType: "staff_user",
        entityId: staffIdToUpdate,
        oldValues: null,
        newValues: { password_changed: true },
        ipAddress: perm.ipAddress,
      });
    }

    if (updates.length === 0 && !newPassword) {
      return Response.json({ user: oldUser });
    }

    if (updates.length > 0) {
      values.push(staffIdToUpdate);
      const query = `UPDATE staff_users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id`;
      await sql(query, values);
    }

    const newRows = await sql`
      SELECT s.id, s.email, s.full_name, s.phone, s.role_id, s.is_active,
             r.role_name
      FROM staff_users s
      LEFT JOIN user_roles r ON r.id = s.role_id
      WHERE s.id = ${staffIdToUpdate}
      LIMIT 1
    `;

    const newUser = newRows?.[0] || null;

    if (updates.length > 0) {
      await writeAuditLog({
        staffId: perm.staff.id,
        action: "staff_user_update",
        entityType: "staff_user",
        entityId: staffIdToUpdate,
        oldValues: oldUser,
        newValues: newUser,
        ipAddress: perm.ipAddress,
      });
    }

    return Response.json({ user: newUser });
  } catch (error) {
    console.error("Error updating staff user:", error);
    return Response.json(
      { error: "Failed to update staff user" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  const staffIdToDelete = Number(id);
  if (!staffIdToDelete || !Number.isFinite(staffIdToDelete)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const oldRows = await sql`
      SELECT s.id, s.email, s.full_name, s.phone, s.role_id, s.is_active,
             r.role_name
      FROM staff_users s
      LEFT JOIN user_roles r ON r.id = s.role_id
      WHERE s.id = ${staffIdToDelete}
      LIMIT 1
    `;

    const oldUser = oldRows?.[0] || null;
    if (!oldUser) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Prevent an admin from deleting themselves
    if (oldUser.email === perm.staff.email) {
      return Response.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    // Delete the staff_users record
    await sql`DELETE FROM staff_users WHERE id = ${staffIdToDelete}`;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "staff_user_delete",
      entityType: "staff_user",
      entityId: staffIdToDelete,
      oldValues: oldUser,
      newValues: null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff user:", error);
    return Response.json(
      { error: "Failed to delete staff user" },
      { status: 500 },
    );
  }
}
