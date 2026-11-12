import { redirect, Navigate } from "react-router";

// The Auto Apply page was removed: credit is applied automatically (payment on
// account, holding allocation, monthly run), and its list / per-tenant Apply
// called an API that never existed. This route stays only so old bookmarks
// land on /payments instead of a 404. POST /api/payments/auto-apply-all
// (Admin-only) and the shared auto-apply functions are unchanged.

export function loader() {
  return redirect("/payments");
}

export default function AutoApplyRedirect() {
  // Fallback if the loader redirect is ever bypassed on the client.
  return <Navigate to="/payments" replace />;
}
