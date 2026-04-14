import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * PATCH /api/notifications/[id]
 * Mark a single notification as read
 */
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifId = toNumber(params.id);
    if (!notifId) {
      return Response.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // Get staff user ID from auth user email
    const staffUser = await sql`
      SELECT id FROM staff_users WHERE email = ${session.user.email} AND is_active = true
    `;

    if (!staffUser || staffUser.length === 0) {
      return Response.json({ error: "Staff user not found" }, { status: 404 });
    }

    const userId = staffUser[0].id;

    // Mark as read (only if it belongs to this user)
    const result = await sql`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${notifId} AND user_id = ${userId}
      RETURNING id
    `;

    if (!result || result.length === 0) {
      return Response.json(
        { error: "Notification not found or access denied" },
        { status: 404 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return Response.json(
      { error: "Failed to mark notification as read" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete a single notification (optional - for future use)
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifId = toNumber(params.id);
    if (!notifId) {
      return Response.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    // Get staff user ID from auth user email
    const staffUser = await sql`
      SELECT id FROM staff_users WHERE email = ${session.user.email} AND is_active = true
    `;

    if (!staffUser || staffUser.length === 0) {
      return Response.json({ error: "Staff user not found" }, { status: 404 });
    }

    const userId = staffUser[0].id;

    // Delete notification (only if it belongs to this user)
    const result = await sql`
      DELETE FROM notifications
      WHERE id = ${notifId} AND user_id = ${userId}
      RETURNING id
    `;

    if (!result || result.length === 0) {
      return Response.json(
        { error: "Notification not found or access denied" },
        { status: 404 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return Response.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
