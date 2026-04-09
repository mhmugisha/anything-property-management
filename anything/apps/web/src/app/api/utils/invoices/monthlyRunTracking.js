import sql from "@/app/api/utils/sql";
import {
  getLastMonthlyDueCheckAtMs,
  setLastMonthlyDueCheckAtMs,
  getLastMonthlyDueResult,
  setLastMonthlyDueResult,
  getMonthlyDueCheckIntervalMs,
} from "./throttling";

export async function isMonthlyRunRecordedAsSuccess({
  invoiceMonth,
  invoiceYear,
}) {
  const rows = await sql(
    `
      SELECT 1
      FROM invoice_generation_runs
      WHERE invoice_month = $1
        AND invoice_year = $2
        AND status = 'success'
      LIMIT 1
    `,
    [invoiceMonth, invoiceYear],
  );
  return (rows?.length || 0) > 0;
}

export async function isMonthlyInvoiceGenerationDue(nowDate = new Date()) {
  const now = Date.now();
  if (now - getLastMonthlyDueCheckAtMs() < getMonthlyDueCheckIntervalMs()) {
    return getLastMonthlyDueResult() === true;
  }

  setLastMonthlyDueCheckAtMs(now);

  const day = nowDate.getDate();
  if (day !== 1) {
    setLastMonthlyDueResult(false);
    return false;
  }

  const invoiceMonth = nowDate.getMonth() + 1;
  const invoiceYear = nowDate.getFullYear();

  const alreadyRan = await isMonthlyRunRecordedAsSuccess({
    invoiceMonth,
    invoiceYear,
  });

  setLastMonthlyDueResult(!alreadyRan);
  return !alreadyRan;
}

export async function recordMonthlyRunStart(runMonth, runYear) {
  try {
    await sql(
      `
        INSERT INTO invoice_generation_runs (invoice_month, invoice_year, status, started_at, finished_at, inserted_count, error)
        VALUES ($1, $2, 'running', NOW(), NULL, 0, NULL)
        ON CONFLICT (invoice_year, invoice_month)
        DO UPDATE SET status = 'running', started_at = EXCLUDED.started_at, finished_at = NULL
      `,
      [runMonth, runYear],
    );
  } catch (e) {
    // don't fail invoice generation if logging fails
    console.error("Failed to record invoice_generation_runs start", e);
  }
}

export async function recordMonthlyRunSuccess(
  runMonth,
  runYear,
  insertedCount,
) {
  try {
    await sql(
      `
        INSERT INTO invoice_generation_runs (invoice_month, invoice_year, status, started_at, finished_at, inserted_count, error)
        VALUES ($1, $2, 'success', NOW(), NOW(), $3, NULL)
        ON CONFLICT (invoice_year, invoice_month)
        DO UPDATE SET status = 'success', finished_at = NOW(), inserted_count = $3, error = NULL
      `,
      [runMonth, runYear, insertedCount],
    );
  } catch (e) {
    console.error("Failed to record invoice_generation_runs success", e);
  }
}

export async function recordMonthlyRunFailure(runMonth, runYear, error) {
  try {
    await sql(
      `
        INSERT INTO invoice_generation_runs (invoice_month, invoice_year, status, started_at, finished_at, inserted_count, error)
        VALUES ($1, $2, 'failed', NOW(), NOW(), 0, $3)
        ON CONFLICT (invoice_year, invoice_month)
        DO UPDATE SET status = 'failed', finished_at = NOW(), inserted_count = 0, error = $3
      `,
      [runMonth, runYear, String(error?.message || error)],
    );
  } catch (e) {
    console.error("Failed to record invoice_generation_runs failure", e);
  }
}
