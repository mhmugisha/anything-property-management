import { requirePermission } from "@/app/api/utils/staff";
import {
  ensureInvoicesForAllActiveLeasesUpToCurrentMonth,
  isMonthlyInvoiceGenerationDue,
} from "@/app/api/utils/invoices";

function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseRunDateFromRequest(request) {
  const { searchParams } = new URL(request.url);
  const month = toInt(searchParams.get("month"));
  const year = toInt(searchParams.get("year"));

  if (!month && !year) {
    return {
      runDate: new Date(),
      recordMonthlyRun: false,
      month: null,
      year: null,
    };
  }

  if (!month || !year) {
    return { error: "month and year must be provided together" };
  }

  if (month < 1 || month > 12) {
    return { error: "month must be between 1 and 12" };
  }

  if (year < 2000 || year > 2100) {
    return { error: "year must be between 2000 and 2100" };
  }

  return {
    runDate: new Date(year, month - 1, 1),
    recordMonthlyRun: true,
    month,
    year,
  };
}

/**
 * Check if request is from Vercel Cron (bypasses authentication)
 */
function isVercelCronRequest(request) {
  const cronHeader = request.headers.get("x-vercel-cron");
  return cronHeader === "1";
}

export async function POST(request) {
  // Allow Vercel Cron to bypass authentication
  const isCronRequest = isVercelCronRequest(request);

  if (!isCronRequest) {
    const perm = await requirePermission(request, "reports");
    if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  }

  try {
    // Log if this is a cron-triggered run
    if (isCronRequest) {
      console.log("[CRON] Monthly invoice generation triggered by Vercel Cron");
    }

    const body = await request.json().catch(() => ({}));
    const bodyMonth = toInt(body?.month);
    const bodyYear = toInt(body?.year);

    let runDate = new Date();
    let recordMonthlyRun = false;
    let targetMonth = null;
    let targetYear = null;

    if (bodyMonth || bodyYear) {
      if (!bodyMonth || !bodyYear) {
        return Response.json(
          { error: "month and year must be provided together" },
          { status: 400 },
        );
      }
      if (bodyMonth < 1 || bodyMonth > 12) {
        return Response.json(
          { error: "month must be between 1 and 12" },
          { status: 400 },
        );
      }
      if (bodyYear < 2000 || bodyYear > 2100) {
        return Response.json(
          { error: "year must be between 2000 and 2100" },
          { status: 400 },
        );
      }

      runDate = new Date(bodyYear, bodyMonth - 1, 1);
      recordMonthlyRun = true;
      targetMonth = bodyMonth;
      targetYear = bodyYear;
    }

    const monthlyDue = await isMonthlyInvoiceGenerationDue(new Date());

    // We always force here because this is an explicit action.
    const insertedCount =
      await ensureInvoicesForAllActiveLeasesUpToCurrentMonth({
        force: true,
        runDate,
        recordMonthlyRun,
      });

    return Response.json({
      ok: true,
      monthlyDue,
      insertedCount,
      recordedFor: recordMonthlyRun
        ? { month: targetMonth, year: targetYear }
        : null,
    });
  } catch (error) {
    console.error("POST /api/invoices/generate-monthly error", error);
    return Response.json(
      { error: "Failed to generate invoices" },
      { status: 500 },
    );
  }
}

// Convenience: allow GET for quick testing in browser.
export async function GET(request) {
  // Allow Vercel Cron to bypass authentication
  const isCronRequest = isVercelCronRequest(request);

  if (!isCronRequest) {
    const perm = await requirePermission(request, "reports");
    if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  }

  try {
    // Log if this is a cron-triggered run
    if (isCronRequest) {
      console.log(
        "[CRON] Monthly invoice generation triggered by Vercel Cron (GET)",
      );
    }

    const { searchParams } = new URL(request.url);
    const force = (searchParams.get("force") || "").trim() === "1";

    const parsed = parseRunDateFromRequest(request);
    if (parsed?.error) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const monthlyDue = await isMonthlyInvoiceGenerationDue(new Date());

    const insertedCount =
      await ensureInvoicesForAllActiveLeasesUpToCurrentMonth({
        force: force === true,
        runDate: parsed.runDate,
        recordMonthlyRun: parsed.recordMonthlyRun,
      });

    return Response.json({
      ok: true,
      monthlyDue,
      insertedCount,
      recordedFor: parsed.recordMonthlyRun
        ? { month: parsed.month, year: parsed.year }
        : null,
    });
  } catch (error) {
    console.error("GET /api/invoices/generate-monthly error", error);
    return Response.json(
      { error: "Failed to generate invoices" },
      { status: 500 },
    );
  }
}
