import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the current user
 */
export async function POST() {
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

    // Mark all unread notifications as read
    const result = await sql`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = ${userId} AND is_read = false
      RETURNING id
    `;

    const updated = result ? result.length : 0;

    return Response.json({
      success: true,
      updated,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return Response.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 },
    );
  }
}
