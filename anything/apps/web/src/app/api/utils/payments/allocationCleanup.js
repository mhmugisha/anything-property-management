// Side effects of a payment_invoice_allocations row, and how to undo them.
//
// Applying money to an invoice can create, besides the allocation row itself:
//   1. a 'payment_auto_apply' GL entry (Dr 2150 / Cr 1210), keyed by
//      source_id = allocation id (auto-apply only);
//   2. an arrears-recovery fee: a landlord_deductions row plus its
//      'landlord_deduction' GL entry (Dr 2100 / Cr 4100), created when the
//      invoice is an arrears invoice at a percent-fee property.
//
// Every path that deletes allocations (payment delete/reverse, approval reject
// of a payment, approval reject of an invoice) must undo both, BEFORE the
// allocation rows are deleted. They all use allocationSideEffectQueries() so
// the cleanup is identical everywhere.
//
// Arrears fees are linked to their allocation through
// landlord_deductions.reference_number = arrearsFeeReference(allocationId).
// Fees created before that tag existed carry no link and are not touched.

export const ARREARS_FEE_REF_PREFIX = "ARREARS-FEE-ALLOC-";

export function arrearsFeeReference(allocationId) {
  const id = Number(allocationId);
  return Number.isFinite(id) && id > 0 ? `${ARREARS_FEE_REF_PREFIX}${id}` : null;
}

/**
 * Queries that undo the side effects of the given allocations. Push them into
 * the same sql.transaction that deletes the allocations.
 *
 * @param {Function} q  tagged-template sql (the txn passed to
 *                      sql.transaction(cb), or the top-level sql)
 * @param {object} p
 * @param {number[]} p.allocationIds  captured BEFORE the allocations are deleted
 * @param {number|null} p.staffId
 * @returns {Array} queries (empty when there is nothing to undo)
 */
export function allocationSideEffectQueries(q, { allocationIds, staffId = null }) {
  const ids = (allocationIds || [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (ids.length === 0) return [];
  const refs = ids.map(arrearsFeeReference);

  return [
    // 1. Auto-apply GL entries for these allocations.
    q`
      UPDATE transactions
      SET is_deleted = true,
          deleted_at = now(),
          deleted_by = ${staffId}
      WHERE source_type = 'payment_auto_apply'
        AND source_id = ANY(${ids}::int[])
        AND COALESCE(is_deleted, false) = false
      RETURNING id
    `,
    // 2a. GL entries of the arrears-recovery fees for these allocations.
    q`
      UPDATE transactions
      SET is_deleted = true,
          deleted_at = now(),
          deleted_by = ${staffId}
      WHERE source_type = 'landlord_deduction'
        AND source_id IN (
          SELECT id FROM landlord_deductions
          WHERE reference_number = ANY(${refs}::text[])
        )
        AND COALESCE(is_deleted, false) = false
      RETURNING id
    `,
    // 2b. The arrears-recovery fee deductions themselves.
    q`
      UPDATE landlord_deductions
      SET is_deleted = true
      WHERE reference_number = ANY(${refs}::text[])
        AND COALESCE(is_deleted, false) = false
      RETURNING id
    `,
  ];
}
