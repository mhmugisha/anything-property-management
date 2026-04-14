/**
 * Railway cron job: monthly invoice generation
 * Schedule: 1st of every month at 01:00 UTC (04:00 Uganda time)
 *
 * Required env vars:
 *   APP_URL       - base URL of the web service, e.g. https://yourapp.railway.app
 *   CRON_SECRET   - shared secret (must match the web service's CRON_SECRET)
 */

const APP_URL = process.env.APP_URL?.replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET;

if (!APP_URL) {
  console.error('[cron-generate-invoices] ERROR: APP_URL env var is not set');
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error('[cron-generate-invoices] ERROR: CRON_SECRET env var is not set');
  process.exit(1);
}

console.log(`[cron-generate-invoices] Calling ${APP_URL}/api/invoices/generate-monthly`);

let res;
try {
  res = await fetch(`${APP_URL}/api/invoices/generate-monthly`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });
} catch (err) {
  console.error('[cron-generate-invoices] Request failed:', err.message);
  process.exit(1);
}

let body;
try {
  body = await res.json();
} catch {
  body = await res.text();
}

if (!res.ok) {
  console.error(`[cron-generate-invoices] HTTP ${res.status}:`, JSON.stringify(body));
  process.exit(1);
}

console.log('[cron-generate-invoices] Success:', JSON.stringify(body, null, 2));
