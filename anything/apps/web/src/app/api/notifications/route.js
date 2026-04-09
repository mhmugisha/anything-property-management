import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * GET /api/notifications
 * Get paginated notifications for the current user
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - unreadOnly: true to show only unread (default: false)
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
    );
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const offset = (page - 1) * limit;

    // Get staff user ID from auth user email
    const staffUser = await sql`
      SELECT id FROM staff_users WHERE email = ${session.user.email} AND is_active = true
    `;

    if (!staffUser || staffUser.length === 0) {
      return Response.json({ error: "Staff user not found" }, { status: 404 });
    }

    const userId = staffUser[0].id;

    // Build the WHERE clause
    let whereCondition = "user_id = $1";
    const params = [userId];

    if (unreadOnly) {
      whereCondition += " AND is_read = false";
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM notifications WHERE ${whereCondition}`;
    const countResult = await sql(countQuery, params);
    const total = parseInt(countResult[0].total, 10);

    // Get unread count (always useful for badge)
    const unreadResult = await sql`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ${userId} AND is_read = false
    `;
    const unreadCount = parseInt(unreadResult[0].count, 10);

    // Get paginated notifications
    const notificationsQuery = `
      SELECT 
        id, 
        title, 
        message, 
        type, 
        is_read, 
        reference_id, 
        reference_type, 
        created_at
      FROM notifications
      WHERE ${whereCondition}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const notifications = await sql(notificationsQuery, [
      ...params,
      limit,
      offset,
    ]);

    return Response.json({
      notifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return Response.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
