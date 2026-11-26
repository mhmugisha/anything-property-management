import { redirect, Navigate } from "react-router";

// The Void Transaction page was removed: Void is now allowed only on manual /
// GL-only journal entries (see utils/voidPolicy.js), and those already have
// Edit/Delete in the Journal. This route stays only so old bookmarks land on
// the Journal instead of a 404. POST /api/accounting/transactions/[id]/void
// and utils/voidPolicy.js are unchanged.

export function loader() {
  return redirect("/accounting/journal");
}

export default function VoidTransactionRedirect() {
  // Fallback if the loader redirect is ever bypassed on the client.
  return <Navigate to="/accounting/journal" replace />;
}
