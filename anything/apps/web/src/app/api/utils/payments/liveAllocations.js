import sql from "@/app/api/utils/sql";

// "Live applied" for an invoice = sum of allocation amounts backed by a
// non-reversed, approved payment. This is the ledger truth used by the
// tenant-statement / payment-status reports, and it is the correct basis
// for both the void guard and the edit floor. It ignores drift in
// invoices.paid_amount (which can overstate in edge cases).
export async function getInvoiceLiveApplied(invoiceId) {
  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) return 0;

  const rows = await sql(
    `SELECT COALESCE(SUM(pia.amount_applied), 0)::numeric AS live_applied
     FROM payment_invoice_allocations pia
     JOIN payments p ON p.id = pia.payment_id
     WHERE pia.invoice_id = $1
       AND p.is_reversed = false
       AND COALESCE(p.approval_status, 'approved') = 'approved'`,
    [id],
  );

  return Number(rows?.[0]?.live_applied || 0);
}

export async function hasLivePaymentApplied(invoiceId) {
  return (await getInvoiceLiveApplied(invoiceId)) > 0;
}

// Returns the list of currently-applied payments for an invoice — used to
// tell the user WHICH payments are blocking a void/delete, so they can
// reverse the right one.
export async function getInvoiceLiveAppliedPayments(invoiceId) {
  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const rows = await sql(
    `SELECT
       p.id AS payment_id,
       pia.id AS allocation_id,
       p.payment_date,
       pia.amount_applied,
       p.payment_method,
       p.reference_number
     FROM payment_invoice_allocations pia
     JOIN payments p ON p.id = pia.payment_id
     WHERE pia.invoice_id = $1
       AND p.is_reversed = false
       AND COALESCE(p.approval_status, 'approved') = 'approved'
     ORDER BY p.payment_date ASC, p.id ASC`,
    [id],
  );

  return (rows || []).map((r) => ({
    payment_id: Number(r.payment_id),
    allocation_id: Number(r.allocation_id),
    payment_date: r.payment_date,
    amount_applied: Number(r.amount_applied || 0),
    payment_method: r.payment_method || null,
    reference_number: r.reference_number || null,
  }));
}
