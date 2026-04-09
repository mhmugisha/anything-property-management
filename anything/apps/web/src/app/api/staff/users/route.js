import sql from "@/app/api/utils/sql";
import { getStaffContext, writeAuditLog } from "@/app/api/utils/staff";
import { hash } from "argon2";

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const e = email.trim();
  if (!e) return false;
  // basic sanity check
  return e.includes("@") && e.includes(".");
}

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

export async function GET(request) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const rows = await sql`
      SELECT s.id, s.email, s.full_name, s.phone, s.role_id, s.is_active, s.last_login, s.created_at,
             r.role_name
      FROM staff_users s
      LEFT JOIN user_roles r ON r.id = s.role_id
      ORDER BY COALESCE(s.full_name,''), s.email
    `;

    return Response.json({ users: rows || [] });
  } catch (error) {
    console.error("Error listing staff users:", error);
    return Response.json(
      { error: "Failed to list staff users" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requireAdmin(request);
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const fullName =
      typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const password =
      typeof body?.password === "string" ? body.password.trim() : "";

    const roleId =
      body?.role_id !== undefined && body?.role_id !== null
        ? Number(body.role_id)
        : null;

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    if (!roleId || !Number.isFinite(roleId)) {
      return Response.json({ error: "Role is required" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return Response.json(
        { error: "Password is required and must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Admin role is now allowed — admins can create other admins

    const existing =
      await sql`SELECT id FROM staff_users WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return Response.json(
        { error: "A staff user with this email already exists" },
        { status: 409 },
      );
    }

    // Check if an auth_users record already exists for this email
    const existingAuth =
      await sql`SELECT id FROM auth_users WHERE email = ${email} LIMIT 1`;

    let authUserId = null;

    if (existingAuth.length > 0) {
      // Auth user exists (maybe they signed up before). Update their password.
      authUserId = existingAuth[0].id;
      const hashedPassword = await hash(password);

      // Check if they already have a credentials account
      const existingAccount = await sql(
        `SELECT id FROM auth_accounts WHERE "userId" = $1 AND provider = 'credentials' LIMIT 1`,
        [authUserId],
      );

      if (existingAccount.length > 0) {
        // Update existing password
        await sql(
          `UPDATE auth_accounts SET password = $1 WHERE "userId" = $2 AND provider = 'credentials'`,
          [hashedPassword, authUserId],
        );
      } else {
        // Create credentials account
        await sql(
          `INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password) VALUES ($1, 'credentials', 'credentials', $2, $3)`,
          [authUserId, String(authUserId), hashedPassword],
        );
      }
    } else {
      // Create auth_users record + auth_accounts record
      const hashedPassword = await hash(password);
      const userName = fullName || email;

      const authInserted = await sql`
        INSERT INTO auth_users (name, email)
        VALUES (${userName}, ${email})
        RETURNING id
      `;
      authUserId = authInserted?.[0]?.id || null;

      if (authUserId) {
        await sql(
          `INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password) VALUES ($1, 'credentials', 'credentials', $2, $3)`,
          [authUserId, String(authUserId), hashedPassword],
        );
      }
    }

    // Create staff_users record
    const insertedRows = await sql`
      INSERT INTO staff_users (email, full_name, role_id, phone, is_active)
      VALUES (${email}, ${fullName || email}, ${roleId}, ${phone || null}, true)
      RETURNING id
    `;

    const insertedId = insertedRows?.[0]?.id || null;

    const created = await sql`
      SELECT s.id, s.email, s.full_name, s.phone, s.role_id, s.is_active, s.last_login, s.created_at,
             r.role_name
      FROM staff_users s
      LEFT JOIN user_roles r ON r.id = s.role_id
      WHERE s.id = ${insertedId}
      LIMIT 1
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "staff_user_create",
      entityType: "staff_user",
      entityId: insertedId,
      oldValues: null,
      newValues: created?.[0] || null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ user: created?.[0] || null });
  } catch (error) {
    console.error("Error creating staff user:", error);
    return Response.json(
      { error: "Failed to create staff user" },
      { status: 500 },
    );
  }
}
