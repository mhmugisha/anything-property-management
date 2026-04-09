import sql from "@/app/api/utils/sql";

/**
 * Create a notification for a specific user
 * Fire-and-forget pattern - never throws errors
 *
 * @param {Object} params
 * @param {number} params.user_id - Staff user ID to notify
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - Notification type (e.g., 'payment', 'lease', 'maintenance')
 * @param {number} [params.reference_id] - Optional ID of related entity
 * @param {string} [params.reference_type] - Optional type of related entity
 * @returns {Promise<boolean>} - true if successful, false if failed
 */
export async function createNotification({
  user_id,
  title,
  message,
  type,
  reference_id = null,
  reference_type = null,
}) {
  try {
    // Validate required fields
    if (!user_id || !title || !message || !type) {
      console.error("Missing required notification fields:", {
        user_id,
        title,
        message,
        type,
      });
      return false;
    }

    // Insert notification
    await sql`
      INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type, is_read, created_at)
      VALUES (${user_id}, ${title}, ${message}, ${type}, ${reference_id}, ${reference_type}, false, NOW())
    `;

    return true;
  } catch (error) {
    // Never throw - just log and continue
    console.error("Failed to create notification:", error);
    return false;
  }
}

/**
 * Send notification to all admin users ONLY (active or inactive)
 * Fire-and-forget pattern - never throws errors
 *
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - Notification type
 * @param {number} [params.reference_id] - Optional ID of related entity
 * @param {string} [params.reference_type] - Optional type of related entity
 * @returns {Promise<number>} - Number of admins notified (0 if failed)
 */
export async function notifyAllAdmins({
  title,
  message,
  type,
  reference_id = null,
  reference_type = null,
}) {
  try {
    // Validate required fields
    if (!title || !message || !type) {
      console.error("Missing required notification fields:", {
        title,
        message,
        type,
      });
      return 0;
    }

    // Get all admin user IDs (active or inactive - they can read when they sign in)
    const adminUsers = await sql`
      SELECT s.id
      FROM staff_users s
      LEFT JOIN user_roles r ON s.role_id = r.id
      WHERE r.role_name = 'Admin'
    `;

    if (!adminUsers || adminUsers.length === 0) {
      console.warn("No admin users found to notify");
      return 0;
    }

    // Create notification for each admin
    let notifiedCount = 0;
    for (const admin of adminUsers) {
      const success = await createNotification({
        user_id: admin.id,
        title,
        message,
        type,
        reference_id,
        reference_type,
      });
      if (success) notifiedCount++;
    }

    return notifiedCount;
  } catch (error) {
    // Never throw - just log and continue
    console.error("Failed to notify admins:", error);
    return 0;
  }
}

/**
 * Create notification without awaiting (true fire-and-forget)
 * Use this when you don't care about the result and want zero blocking
 *
 * @param {Object} params - Same as createNotification
 */
export function createNotificationAsync(params) {
  createNotification(params).catch((err) =>
    console.error("Async notification failed:", err),
  );
}

/**
 * Notify all admins without awaiting (true fire-and-forget)
 * Use this when you don't care about the result and want zero blocking
 *
 * @param {Object} params - Same as notifyAllAdmins
 */
export function notifyAllAdminsAsync(params) {
  notifyAllAdmins(params).catch((err) =>
    console.error("Async admin notification failed:", err),
  );
}
