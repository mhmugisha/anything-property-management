import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoicesForAllActiveLeasesUpToCurrentMonth } from "@/app/api/utils/invoices";

// Returns { month, year } as the current calendar month in the given IANA
// timezone. This matters because our server may run in UTC while operations
// are in Africa/Kampala (UTC+3, no DST) — the last few hours of the local
// month can still be the prior UTC month.
function getCurrentMonthYearInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  return { month, year };
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff?.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    // Month/year are derived server-side in Africa/Kampala; the client cannot
    // override this by sending a body.
    const { month, year } = getCurrentMonthYearInTimezone("Africa/Kampala");

    const result = await ensureInvoicesForAllActiveLeasesUpToCurrentMonth({
      force: true,
      singleMonth: true,
      month,
      year,
      runDate: new Date(year, month - 1, 1),
      recordMonthlyRun: true,
    });

    try {
      await writeAuditLog({
        staffId: perm.staff.id,
        action: "monthly_invoices.generate_manual",
        entityType: "invoice_batch",
        entityId: null,
        oldValues: null,
        newValues: {
          month,
          year,
          created: result.created,
          skipped: result.skipped,
        },
        ipAddress: perm.ipAddress,
      });
    } catch (auditErr) {
      console.error(
        "writeAuditLog failed for monthly_invoices.generate_manual",
        auditErr,
      );
    }

    return Response.json({
      ok: true,
      month,
      year,
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error(
      "POST /api/accounting/generate-current-month-invoices error",
      error,
    );
    return Response.json(
      { error: "Failed to generate invoices" },
      { status: 500 },
    );
  }
}
