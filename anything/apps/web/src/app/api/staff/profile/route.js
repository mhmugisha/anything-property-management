import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Admin users should have all permissions
function ensureAdminPermissions(staff) {
  if (!staff) return staff;

  if (staff.role_name === "Admin") {
    return {
      ...staff,
      permissions: {
        dashboard: true,
        properties: true,
        tenants: true,
        payments: true,
        reports: true,
        accounting: true,
        maintenance: true,
      },
    };
  }

  return staff;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;

    const staff = await sql`
      SELECT s.*, r.role_name, r.permissions
      FROM staff_users s
      LEFT JOIN user_roles r ON s.role_id = r.id
      WHERE s.email = ${userEmail}
      LIMIT 1
    `;

    if (staff.length === 0) {
      // Bootstrap behavior:
      // If this is the first person to sign in (no staff users yet),
      // automatically create them as an Admin so they can use the app
      // without getting stuck on onboarding.
      const staffCountRows =
        await sql`SELECT COUNT(*)::int AS count FROM staff_users`;
      const staffCount = Number(staffCountRows?.[0]?.count || 0);

      if (staffCount === 0) {
        const adminRoleRows = await sql`
          SELECT id
          FROM user_roles
          WHERE role_name = 'Admin'
          LIMIT 1
        `;

        const adminRoleId = adminRoleRows?.[0]?.id || null;
        const fullName = session.user.name || userEmail;

        if (adminRoleId) {
          await sql`
            INSERT INTO staff_users (email, full_name, role_id, is_active)
            VALUES (${userEmail}, ${fullName}, ${adminRoleId}, true)
          `;

          const bootstrapped = await sql`
            SELECT s.*, r.role_name, r.permissions
            FROM staff_users s
            LEFT JOIN user_roles r ON s.role_id = r.id
            WHERE s.email = ${userEmail}
            LIMIT 1
          `;

          return Response.json({
            staff: ensureAdminPermissions(bootstrapped?.[0]) || null,
          });
        }
      }

      return Response.json({ staff: null });
    }

    return Response.json({ staff: ensureAdminPermissions(staff[0]) });
  } catch (error) {
    console.error("Error fetching staff profile:", error);
    return Response.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { profile_picture, phone } = body;

    // Build the update dynamically based on what's provided
    let updateQuery;
    let result;

    if (profile_picture !== undefined && phone !== undefined) {
      // Both provided
      if (typeof profile_picture !== "string") {
        return new Response("Invalid profile_picture URL", { status: 400 });
      }
      result = await sql`
        UPDATE staff_users
        SET profile_picture = ${profile_picture}, phone = ${phone}
        WHERE email = ${session.user.email}
        RETURNING id, email, full_name, profile_picture, phone
      `;
    } else if (profile_picture !== undefined) {
      // Only profile picture
      if (typeof profile_picture !== "string") {
        return new Response("Invalid profile_picture URL", { status: 400 });
      }
      result = await sql`
        UPDATE staff_users
        SET profile_picture = ${profile_picture}
        WHERE email = ${session.user.email}
        RETURNING id, email, full_name, profile_picture, phone
      `;
    } else if (phone !== undefined) {
      // Only phone
      result = await sql`
        UPDATE staff_users
        SET phone = ${phone}
        WHERE email = ${session.user.email}
        RETURNING id, email, full_name, profile_picture, phone
      `;
    } else {
      return new Response("No fields to update", { status: 400 });
    }

    if (result.length === 0) {
      return new Response("Staff user not found", { status: 404 });
    }

    return Response.json({
      success: true,
      profile: result[0],
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to update profile",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
