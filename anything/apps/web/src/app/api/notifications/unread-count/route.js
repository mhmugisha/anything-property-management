import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * GET /api/notifications/unread-count
 * Quick endpoint to get unread notification count for badge
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get staff user ID from auth user email
    const staffUser = await sql`
      SELECT id FROM staff_users WHERE email = ${session.user.email} AND is_active = true
    `;

    if (!staffUser || staffUser.length === 0) {
      return Response.json({ error: "Staff user not found" }, { status: 404 });
    }

    const userId = staffUser[0].id;

    // Get unread count
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = ${userId} AND is_read = false
    `;

    const count = parseInt(result[0].count, 10);

    return Response.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return Response.json(
      { error: "Failed to fetch unread count" },
      { status: 500 },
    );
  }
}
