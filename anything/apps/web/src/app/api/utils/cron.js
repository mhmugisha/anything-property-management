/**
 * Validates that an incoming request is a legitimate Vercel Cron invocation.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled calls.
 * The x-vercel-cron header alone is spoofable; the signed Bearer token is not.
 */
export function isVercelCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
