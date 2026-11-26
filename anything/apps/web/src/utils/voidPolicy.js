// Which GL rows may be removed with "Void transaction".
//
// Void only soft-deletes the one GL row. That is a complete undo only for
// rows with no source record behind them. A row that belongs to a source
// record (deduction, payout, payment, deposit, payroll, invoice, ...) must be
// undone from that record, otherwise the record stays live (e.g. a landlord
// deduction still on the Payment Note) while its GL row is gone.
//
// Shared by POST /api/accounting/transactions/[id]/void and the Void page.

// GL-only source types: voiding the row undoes everything.
//   null / ""        legacy rows from before source tracking (manual entries)
//   manual           journal entries posted via /api/accounting/transactions
//   reconciliation   landlord reconcile adjustments (GL row only, no source table)
const VOIDABLE_SOURCE_TYPES = new Set(["manual", "reconciliation"]);

// Legacy rows with no source_type whose description shows they were written
// by a module (same rule the Journal uses to lock them).
const SYSTEM_DESCRIPTION_PREFIXES = [
  "Rent collection -",
  "Commission -",
  "Landlord payout -",
  "Landlord deduction -",
  "Tenant deduction -",
];

const BLOCK_MESSAGES = {
  landlord_deduction:
    "This entry belongs to a landlord deduction. Delete the deduction instead (Journal, or the Due to Landlords 2100 account page).",
  tenant_deduction:
    "This entry belongs to a tenant deduction. Delete the deduction instead (Journal, or the account page).",
  landlord_payout:
    "This entry belongs to a landlord payout. Delete the payout instead (Journal, or the Cash/Bank account page).",
  payment:
    "This entry belongs to a tenant payment. Delete or reverse the payment instead.",
  payment_allocation:
    "This entry belongs to a payment allocation. Change or delete the payment instead.",
  payment_auto_apply:
    "This entry belongs to a payment auto-apply. Change or delete the payment instead.",
  payment_advance:
    "This entry belongs to an advance payment. Change or delete the payment instead.",
  deposit:
    "This entry belongs to a bank deposit. Reverse the deposit instead (Journal, or the Cash/Bank account page).",
  maintenance:
    "This entry belongs to a maintenance request. Change the maintenance request instead.",
  maintenance_charge:
    "This entry belongs to a maintenance request. Change the maintenance request instead.",
  invoice: "This entry belongs to an invoice. Void or reverse the invoice instead.",
  rent_accrual_summary:
    "This entry is generated from invoices. Change the invoices instead.",
  mgmt_fee_summary:
    "This entry is generated from invoices. Change the invoices instead.",
  mgmt_fee_fixed:
    "This entry is generated from invoices. Change the invoices instead.",
  rent_reversal:
    "This entry is generated from invoices. Change the invoices instead.",
  landlord_collection:
    "This entry belongs to a landlord balance adjustment (settle negative balance). It can't be voided here.",
  landlord_writeoff:
    "This entry belongs to a landlord balance adjustment (settle negative balance). It can't be voided here.",
  payroll_run:
    "This entry belongs to a payroll run. Use Payroll (e.g. return the run to draft) instead.",
  staff_advance:
    "This entry belongs to a staff advance. Void the advance from Payroll instead.",
  termination:
    "This entry belongs to an employee termination. Change it from Payroll instead.",
};

/**
 * @param {{ source_type?: string|null, description?: string|null }} tx
 * @returns {{ ok: true } | { ok: false, sourceType: string|null, error: string }}
 */
export function voidPolicyFor(tx) {
  const src = String(tx?.source_type || "").trim();

  if (!src) {
    const desc = String(tx?.description || "");
    if (SYSTEM_DESCRIPTION_PREFIXES.some((p) => desc.startsWith(p))) {
      return {
        ok: false,
        sourceType: null,
        error:
          "This older entry was created by a module (payment, payout or deduction), not as a manual journal. Undo it from its source record instead.",
      };
    }
    return { ok: true };
  }

  if (VOIDABLE_SOURCE_TYPES.has(src)) return { ok: true };

  const error =
    BLOCK_MESSAGES[src] ||
    (src.startsWith("payroll")
      ? "This entry belongs to Payroll. Change it from Payroll instead."
      : `This entry belongs to a ${src.replace(/_/g, " ")} record. Change it from that record instead.`);

  return { ok: false, sourceType: src, error };
}

export function isVoidable(tx) {
  return voidPolicyFor(tx).ok;
}
