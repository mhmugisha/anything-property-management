import { ensureInvoicesForLease } from "@/app/api/utils/invoices";

// Return a safe, human-readable error message to the UI.
export function safeErrorMessage(error) {
  if (!error) return "Unknown error";

  const msg = typeof error.message === "string" ? error.message : String(error);

  // If this is a Postgres error, include the code/detail (still safe for staff UI).
  const code = typeof error.code === "string" ? error.code : null;
  const detail = typeof error.detail === "string" ? error.detail : null;

  let out = msg;
  if (code) out = `${out} (code: ${code})`;
  if (detail) out = `${out} - ${detail}`;

  // Prevent extremely long responses.
  if (out.length > 600) {
    out = out.slice(0, 600) + "…";
  }

  return out;
}

const NO_INVOICES_WARNING =
  "No invoices were generated for this lease. This can happen if invoice generation was skipped or the lease/property setup blocks billing.";

/**
 * Ensure invoices exist for a just-created lease. Never throws: tenant
 * creation must not fail on invoicing, but problems are surfaced as a
 * warning so staff can act. Safe to re-run (inserts are ON CONFLICT DO
 * NOTHING), and the monthly run backfills anything missed.
 */
export async function ensureInvoicesForNewLease(leaseId, startDate) {
  let invoiceWarning = null;
  let invoiceInsertedCount = null;

  const isStartDateLikelyInPastOrCurrent = (() => {
    try {
      const sd = new Date(`${startDate}T00:00:00Z`);
      if (Number.isNaN(sd.getTime())) return false;
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);
      return sd.getTime() <= currentMonthStart.getTime();
    } catch {
      return false;
    }
  })();

  try {
    invoiceInsertedCount = await ensureInvoicesForLease(leaseId);

    // If we expected at least one invoice but got none, flag it.
    if (
      isStartDateLikelyInPastOrCurrent &&
      Number(invoiceInsertedCount || 0) === 0
    ) {
      invoiceWarning = NO_INVOICES_WARNING;
    }
  } catch (e) {
    console.error(
      "ensureInvoicesForLease failed during tenant creation; retrying once",
      e,
    );

    // quick one-time retry (helps with transient locks)
    try {
      await new Promise((r) => setTimeout(r, 200));
      invoiceInsertedCount = await ensureInvoicesForLease(leaseId);

      if (
        isStartDateLikelyInPastOrCurrent &&
        Number(invoiceInsertedCount || 0) === 0
      ) {
        invoiceWarning = NO_INVOICES_WARNING;
      }
    } catch (e2) {
      console.error(
        "ensureInvoicesForLease failed during tenant creation; continuing",
        e2,
      );
      invoiceWarning = safeErrorMessage(e2);
    }
  }

  return { invoiceInsertedCount, invoiceWarning };
}
