// Throttle heavy invoice backfills so normal page loads stay fast.
// NOTE: This is in-memory per server instance.
let lastEnsureInvoicesAtMs = 0;
let ensureInvoicesPromise = null;
const ENSURE_INVOICES_INTERVAL_MS = 1000 * 60 * 10; // 10 minutes

// NEW: on the 1st day of the month we want to guarantee invoices are generated,
// even if the normal throttle would skip it.
// We persist the per-month run in the DB so "first day" generation survives restarts.
let lastMonthlyDueCheckAtMs = 0;
let lastMonthlyDueResult = null;
const MONTHLY_DUE_CHECK_INTERVAL_MS = 1000 * 60; // 1 minute

// NEW: Keep the accounting ledger in sync with generated invoices.
// We post accrual entries.
let lastEnsureInvoiceLedgerAtMs = 0;
const ENSURE_INVOICE_LEDGER_INTERVAL_MS = 1000 * 60 * 10; // 10 minutes

// NEW: normalize legacy fixed-fee invoices so we don't double-deduct.
let lastNormalizeFixedInvoicesAtMs = 0;
const NORMALIZE_FIXED_INVOICES_INTERVAL_MS = 1000 * 60 * 10; // 10 minutes

export function getLastEnsureInvoicesAtMs() {
  return lastEnsureInvoicesAtMs;
}

export function setLastEnsureInvoicesAtMs(value) {
  lastEnsureInvoicesAtMs = value;
}

export function getEnsureInvoicesPromise() {
  return ensureInvoicesPromise;
}

export function setEnsureInvoicesPromise(value) {
  ensureInvoicesPromise = value;
}

export function getEnsureInvoicesIntervalMs() {
  return ENSURE_INVOICES_INTERVAL_MS;
}

export function getLastMonthlyDueCheckAtMs() {
  return lastMonthlyDueCheckAtMs;
}

export function setLastMonthlyDueCheckAtMs(value) {
  lastMonthlyDueCheckAtMs = value;
}

export function getLastMonthlyDueResult() {
  return lastMonthlyDueResult;
}

export function setLastMonthlyDueResult(value) {
  lastMonthlyDueResult = value;
}

export function getMonthlyDueCheckIntervalMs() {
  return MONTHLY_DUE_CHECK_INTERVAL_MS;
}

export function getLastEnsureInvoiceLedgerAtMs() {
  return lastEnsureInvoiceLedgerAtMs;
}

export function setLastEnsureInvoiceLedgerAtMs(value) {
  lastEnsureInvoiceLedgerAtMs = value;
}

export function getEnsureInvoiceLedgerIntervalMs() {
  return ENSURE_INVOICE_LEDGER_INTERVAL_MS;
}

export function getLastNormalizeFixedInvoicesAtMs() {
  return lastNormalizeFixedInvoicesAtMs;
}

export function setLastNormalizeFixedInvoicesAtMs(value) {
  lastNormalizeFixedInvoicesAtMs = value;
}

export function getNormalizeFixedInvoicesIntervalMs() {
  return NORMALIZE_FIXED_INVOICES_INTERVAL_MS;
}
