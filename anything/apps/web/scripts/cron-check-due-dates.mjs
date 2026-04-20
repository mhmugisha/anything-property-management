/**
 * Railway cron job: daily landlord due date notifications
 * Schedule: daily at 00:00 UTC (03:00 Uganda time)
 *
 * Required env vars:
 *   APP_URL       - base URL of the web service, e.g. https://yourapp.railway.app
 *   CRON_SECRET   - shared secret (must match the web service's CRON_SECRET)
 */

const APP_URL = process.env.APP_URL?.replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_SECRET;

console.log('[cron-check-due-dates] Script started');
console.log(`[cron-check-due-dates] APP_URL: ${APP_URL}`);
console.log(`[cron-check-due-dates] CRON_SECRET is set: ${!!CRON_SECRET}`);
console.log(`[cron-check-due-dates] Node version: ${process.version}`);

if (!APP_URL) {
  console.error('[cron-check-due-dates] ERROR: APP_URL env var is not set');
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error('[cron-check-due-dates] ERROR: CRON_SECRET env var is not set');
  process.exit(1);
}

console.log(`[cron-check-due-dates] Calling ${APP_URL}/api/notifications/check-landlord-due-dates`);

let res;
try {
  res = await fetch(`${APP_URL}/api/notifications/check-landlord-due-dates`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
  });
} catch (err) {
  console.error('[cron-check-due-dates] Request failed:', err.message);
  process.exit(1);
}

let body;
const rawText = await res.text();
console.log(`[cron-check-due-dates] Raw response:`, rawText.slice(0, 500));
try {
  body = JSON.parse(rawText);
} catch {
  body = rawText;
}

if (!res.ok) {
  console.error(`[cron-check-due-dates] HTTP ${res.status}:`, JSON.stringify(body));
  process.exit(1);
}

console.log('[cron-check-due-dates] Success:', JSON.stringify(body, null, 2));
