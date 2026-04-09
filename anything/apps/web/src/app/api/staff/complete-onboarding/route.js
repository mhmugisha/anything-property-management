import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { roleId, phone } = body;

    if (!roleId) {
      return Response.json({ error: "Role is required" }, { status: 400 });
    }

    // Prevent self-assigning Admin role during onboarding
    const adminRoleRows =
      await sql`SELECT id FROM user_roles WHERE role_name = 'Admin' LIMIT 1`;
    const adminRoleId = adminRoleRows?.[0]?.id || null;
    if (adminRoleId && parseInt(roleId) === adminRoleId) {
      return Response.json(
        {
          error:
            "You cannot assign yourself the Admin role. Please contact an administrator.",
        },
        { status: 403 },
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name || userEmail;

    // Check if staff user already exists
    const existingStaff = await sql`
      SELECT id FROM staff_users WHERE email = ${userEmail} LIMIT 1
    `;

    if (existingStaff.length > 0) {
      // Update existing staff user — but don't allow setting admin role
      const existingStaffRow = await sql`
        SELECT s.id, r.role_name FROM staff_users s 
        LEFT JOIN user_roles r ON s.role_id = r.id 
        WHERE s.email = ${userEmail} LIMIT 1
      `;
      const currentRole = existingStaffRow?.[0]?.role_name;

      // If they're already admin (bootstrapped), keep it. Otherwise enforce non-admin.
      const finalRoleId =
        currentRole === "Admin" ? existingStaffRow[0].id : roleId;

      await sql`
        UPDATE staff_users 
        SET role_id = ${finalRoleId}, phone = ${phone || null}, is_active = true
        WHERE email = ${userEmail}
      `;
    } else {
      // Create new staff user
      await sql`
        INSERT INTO staff_users (email, full_name, role_id, phone, is_active)
        VALUES (${userEmail}, ${userName}, ${roleId}, ${phone || null}, true)
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return Response.json(
      { error: "Failed to complete onboarding" },
      { status: 500 },
    );
  }
}
