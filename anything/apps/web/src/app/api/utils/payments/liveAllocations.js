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
