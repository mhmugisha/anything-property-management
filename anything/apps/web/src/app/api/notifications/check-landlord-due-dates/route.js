import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { notifyAllAdmins } from "@/app/api/utils/notifications";
import { getDueToLandlordsBalance } from "@/app/api/utils/accounting";

/**
 * Check if request is from Vercel Cron (bypasses authentication)
 */
function isVercelCronRequest(request) {
  const cronHeader = request.headers.get("x-vercel-cron");
  return cronHeader === "1";
}

/**
 * Daily Landlord Due Date Checker (3 Days Early Notification)
 * Runs as a cron job to check if any landlords have payments due in 3 days
 * Creates notifications for admins about upcoming landlord payments
 *
 * GET /api/notifications/check-landlord-due-dates
 *
 * Features:
 * - Sends notifications 3 days before due date
 * - Handles month boundaries (e.g., Feb 27 for Mar 2 due date)
 * - Prevents duplicate notifications per landlord per month
 * - Handles edge cases (31st in 30-day months, Feb 29/30/31)
 *
 * Returns:
 * {
 *   checked: 45,        // Total landlords checked
 *   notified: 3,        // Landlords with payments due in 3 days
 *   skipped: 2,         // Already notified this month
 *   totalOwed: 5000000  // Total amount owed across all notified landlords
 * }
 */
export async function GET(request) {
  // Allow Vercel Cron to bypass authentication
  const isCronRequest = isVercelCronRequest(request);

  if (!isCronRequest) {
    const perm = await requirePermission(request, "notifications");
    if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  }

  try {
    // Log if this is a cron-triggered run
    if (isCronRequest) {
      console.log("[CRON] Landlord due date check triggered by Vercel Cron");
    }

    const today = new Date();
    const todayYmd = today.toISOString().slice(0, 10);

    console.log(
      `[Landlord Due Date Check] Running for ${todayYmd} (3-day early notification)`,
    );

    // Find all active landlords with a due_date set
    const landlords = await sql`
      SELECT 
        l.id,
        l.full_name,
        l.due_date,
        l.payment_method,
        EXTRACT(DAY FROM l.due_date)::integer AS payment_day
      FROM landlords l
      WHERE l.status = 'active'
        AND l.due_date IS NOT NULL
      ORDER BY l.full_name
    `;

    console.log(
      `[Landlord Due Date Check] Found ${landlords.length} active landlords with due dates`,
    );

    let checkedCount = 0;
    let notifiedCount = 0;
    let skippedCount = 0;
    let totalOwed = 0;

    for (const landlord of landlords) {
      try {
        const paymentDay = landlord.payment_day; // Day of month (1-31)

        // Calculate the actual due date for this month
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11

        // Create date for the due date this month
        let dueDate = new Date(currentYear, currentMonth, paymentDay);

        // Handle edge case: if payment day doesn't exist in this month (e.g., 31st in 30-day month)
        // The Date constructor automatically rolls over, so check if we got the right day
        if (dueDate.getDate() !== paymentDay) {
          // The day doesn't exist in this month, use last day of month
          dueDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
          console.log(
            `[Landlord Due Date Check] Landlord ${landlord.full_name} due on day ${paymentDay} adjusted to ${dueDate.toISOString().slice(0, 10)} (last day of month)`,
          );
        }

        // If the due date already passed this month, check for next month
        if (dueDate < today) {
          // Calculate next month's due date
          dueDate = new Date(currentYear, currentMonth + 1, paymentDay);
          if (dueDate.getDate() !== paymentDay) {
            dueDate = new Date(currentYear, currentMonth + 2, 0); // Last day of next month
          }
        }

        // Calculate notification date (3 days before due date)
        const notificationDate = new Date(dueDate);
        notificationDate.setDate(notificationDate.getDate() - 3);

        // Check if today is the notification date
        const notificationDateYmd = notificationDate.toISOString().slice(0, 10);

        if (todayYmd !== notificationDateYmd) {
          // Not the notification day for this landlord
          continue;
        }

        checkedCount++;
        console.log(
          `[Landlord Due Date Check] Landlord ${landlord.full_name}: Due ${dueDate.toISOString().slice(0, 10)}, Notify ${notificationDateYmd}`,
        );

        // Check if we already notified this landlord this month
        const dueDateYear = dueDate.getFullYear();
        const dueDateMonth = dueDate.getMonth() + 1; // 1-12

        const existingNotification = await sql`
          SELECT id, created_at
          FROM notifications
          WHERE type = 'landlord_due'
            AND reference_type = 'landlord'
            AND reference_id = ${landlord.id}
            AND EXTRACT(YEAR FROM created_at) = ${dueDateYear}
            AND EXTRACT(MONTH FROM created_at) = ${dueDateMonth}
          LIMIT 1
        `;

        if (existingNotification.length > 0) {
          skippedCount++;
          console.log(
            `[Landlord Due Date Check] Landlord ${landlord.full_name} already notified this month - skipping`,
          );
          continue;
        }

        // Get all properties for this landlord
        const properties = await sql`
          SELECT id, property_name
          FROM properties
          WHERE landlord_id = ${landlord.id}
          ORDER BY property_name
        `;

        if (!properties || properties.length === 0) {
          console.log(
            `[Landlord Due Date Check] Landlord ${landlord.full_name} has no properties - skipping`,
          );
          continue;
        }

        // Calculate total owed to this landlord across all their properties
        let landlordTotalOwed = 0;
        const propertyDetails = [];

        for (const property of properties) {
          const owed = await getDueToLandlordsBalance({
            landlordId: landlord.id,
            propertyId: property.id,
          });

          const owedAmount = Number(owed || 0);
          if (owedAmount > 0) {
            landlordTotalOwed += owedAmount;
            propertyDetails.push({
              name: property.property_name,
              owed: owedAmount,
            });
          }
        }

        // Only notify if there's actually money owed
        if (landlordTotalOwed > 0) {
          const propertyList =
            propertyDetails.length <= 3
              ? propertyDetails
                  .map((p) => `${p.name}: UGX ${p.owed.toLocaleString()}`)
                  .join(", ")
              : `${propertyDetails.length} properties`;

          const dueDateFormatted = dueDate.toISOString().slice(0, 10);

          // Create notification for admins
          const notified = await notifyAllAdmins({
            title: "Landlord Payment Due in 3 Days",
            message: `Payment due ${dueDateFormatted} for ${landlord.full_name} - Total: UGX ${landlordTotalOwed.toLocaleString()} (${propertyList})`,
            type: "landlord_due",
            reference_id: landlord.id,
            reference_type: "landlord",
          });

          if (notified > 0) {
            notifiedCount++;
            totalOwed += landlordTotalOwed;
            console.log(
              `[Landlord Due Date Check] Notified admins about ${landlord.full_name} - Due: ${dueDateFormatted}, Owed: UGX ${landlordTotalOwed.toLocaleString()}`,
            );
          }
        } else {
          console.log(
            `[Landlord Due Date Check] Landlord ${landlord.full_name} has no outstanding balance - skipping notification`,
          );
        }
      } catch (landlordError) {
        console.error(
          `[Landlord Due Date Check] Error processing landlord ${landlord.full_name}:`,
          landlordError,
        );
        // Continue with next landlord
      }
    }

    console.log(
      `[Landlord Due Date Check] Complete - Checked: ${checkedCount}, Notified: ${notifiedCount}, Skipped: ${skippedCount}, Total Owed: UGX ${totalOwed.toLocaleString()}`,
    );

    return Response.json({
      success: true,
      checked: checkedCount,
      notified: notifiedCount,
      skipped: skippedCount,
      totalOwed,
      checkDate: todayYmd,
    });
  } catch (error) {
    console.error("[Landlord Due Date Check] Error:", error);
    return Response.json(
      { error: "Failed to check landlord due dates", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * Manual trigger with custom date (for testing)
 * POST /api/notifications/check-landlord-due-dates
 * Body: { testDate: "2024-03-12" }  // Test as if today is this date
 */
export async function POST(request) {
  // Allow Vercel Cron to bypass authentication
  const isCronRequest = isVercelCronRequest(request);

  if (!isCronRequest) {
    const perm = await requirePermission(request, "notifications");
    if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  }

  try {
    // Log if this is a cron-triggered run
    if (isCronRequest) {
      console.log(
        "[CRON] Landlord due date check triggered by Vercel Cron (manual)",
      );
    }

    const body = await request.json();
    const testDateStr = body?.testDate;

    let today;
    if (testDateStr) {
      today = new Date(testDateStr + "T00:00:00");
      if (isNaN(today.getTime())) {
        return Response.json(
          { error: "Invalid testDate format. Use YYYY-MM-DD" },
          { status: 400 },
        );
      }
    } else {
      today = new Date();
    }

    const todayYmd = today.toISOString().slice(0, 10);

    console.log(
      `[Landlord Due Date Check] Manual trigger for ${todayYmd}${testDateStr ? " (test mode)" : ""}`,
    );

    // Find all active landlords with due dates
    const landlords = await sql`
      SELECT 
        l.id,
        l.full_name,
        l.due_date,
        l.payment_method,
        EXTRACT(DAY FROM l.due_date)::integer AS payment_day
      FROM landlords l
      WHERE l.status = 'active'
        AND l.due_date IS NOT NULL
      ORDER BY l.full_name
    `;

    console.log(
      `[Landlord Due Date Check] Found ${landlords.length} active landlords with due dates`,
    );

    let checkedCount = 0;
    let notifiedCount = 0;
    let skippedCount = 0;
    let totalOwed = 0;

    for (const landlord of landlords) {
      try {
        const paymentDay = landlord.payment_day;

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        let dueDate = new Date(currentYear, currentMonth, paymentDay);

        if (dueDate.getDate() !== paymentDay) {
          dueDate = new Date(currentYear, currentMonth + 1, 0);
        }

        if (dueDate < today) {
          dueDate = new Date(currentYear, currentMonth + 1, paymentDay);
          if (dueDate.getDate() !== paymentDay) {
            dueDate = new Date(currentYear, currentMonth + 2, 0);
          }
        }

        const notificationDate = new Date(dueDate);
        notificationDate.setDate(notificationDate.getDate() - 3);

        const notificationDateYmd = notificationDate.toISOString().slice(0, 10);

        if (todayYmd !== notificationDateYmd) {
          continue;
        }

        checkedCount++;

        const dueDateYear = dueDate.getFullYear();
        const dueDateMonth = dueDate.getMonth() + 1;

        const existingNotification = await sql`
          SELECT id, created_at
          FROM notifications
          WHERE type = 'landlord_due'
            AND reference_type = 'landlord'
            AND reference_id = ${landlord.id}
            AND EXTRACT(YEAR FROM created_at) = ${dueDateYear}
            AND EXTRACT(MONTH FROM created_at) = ${dueDateMonth}
          LIMIT 1
        `;

        if (existingNotification.length > 0) {
          skippedCount++;
          console.log(
            `[Landlord Due Date Check] Landlord ${landlord.full_name} already notified - skipping`,
          );
          continue;
        }

        const properties = await sql`
          SELECT id, property_name
          FROM properties
          WHERE landlord_id = ${landlord.id}
          ORDER BY property_name
        `;

        if (!properties || properties.length === 0) {
          continue;
        }

        let landlordTotalOwed = 0;
        const propertyDetails = [];

        for (const property of properties) {
          const owed = await getDueToLandlordsBalance({
            landlordId: landlord.id,
            propertyId: property.id,
          });

          const owedAmount = Number(owed || 0);
          if (owedAmount > 0) {
            landlordTotalOwed += owedAmount;
            propertyDetails.push({
              name: property.property_name,
              owed: owedAmount,
            });
          }
        }

        if (landlordTotalOwed > 0) {
          const propertyList =
            propertyDetails.length <= 3
              ? propertyDetails
                  .map((p) => `${p.name}: UGX ${p.owed.toLocaleString()}`)
                  .join(", ")
              : `${propertyDetails.length} properties`;

          const dueDateFormatted = dueDate.toISOString().slice(0, 10);

          const notified = await notifyAllAdmins({
            title: "Landlord Payment Due in 3 Days",
            message: `Payment due ${dueDateFormatted} for ${landlord.full_name} - Total: UGX ${landlordTotalOwed.toLocaleString()} (${propertyList})`,
            type: "landlord_due",
            reference_id: landlord.id,
            reference_type: "landlord",
          });

          if (notified > 0) {
            notifiedCount++;
            totalOwed += landlordTotalOwed;
            console.log(
              `[Landlord Due Date Check] Notified about ${landlord.full_name} - Due: ${dueDateFormatted}, Owed: UGX ${landlordTotalOwed.toLocaleString()}`,
            );
          }
        }
      } catch (landlordError) {
        console.error(
          `[Landlord Due Date Check] Error processing landlord ${landlord.full_name}:`,
          landlordError,
        );
      }
    }

    console.log(
      `[Landlord Due Date Check] Manual check complete - Checked: ${checkedCount}, Notified: ${notifiedCount}, Skipped: ${skippedCount}`,
    );

    return Response.json({
      success: true,
      checked: checkedCount,
      notified: notifiedCount,
      skipped: skippedCount,
      totalOwed,
      checkDate: todayYmd,
      mode: "manual",
    });
  } catch (error) {
    console.error("[Landlord Due Date Check] Manual trigger error:", error);
    return Response.json(
      { error: "Failed to check landlord due dates", details: error.message },
      { status: 500 },
    );
  }
}
