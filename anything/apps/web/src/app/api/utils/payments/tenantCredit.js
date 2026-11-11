import sql from "@/app/api/utils/sql";

// Tenant credit (unapplied payment money), scoped per PROPERTY.
//
// Rule: a payment's credit belongs to the property on payments.property_id and
// may only ever be applied to invoices at that same property, or refunded /
// written off when a lease at that property ends. Payments with a NULL
// property_id are never treated as credit anywhere.
//
// Source of truth is the payments subledger, not GL 2150:
//   credit(tenant, property) =
//       Σ over non-reversed, APPROVED payments of
//         (amount − Σ payment_invoice_allocations)
//     − Σ prepayment_refund / prepayment_writeoff GL entries (not deleted) for
//       the tenant's leases at that property
// Auto-apply spends exactly this credit, so the balance shown / refunded at
// termination is the same money auto-apply would otherwise apply. Refunds and
// write-offs consume the OLDEST payments first, so refunded money is never
// applied (or refunded) again.

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Loads a tenant's remaining credit, grouped by property.
 *
 * @param {object} p
 * @param {number} p.tenantId
 * @param {number|null} [p.propertyId] limit to one property (optional)
 * @returns {Promise<Map<number, {
 *   propertyId: number,
 *   grossUnapplied: number,   // Σ (payment amount − allocations)
 *   refunded: number,         // Σ refunds + write-offs already posted
 *   balance: number,          // max(0, grossUnapplied − refunded)
 *   payments: Array<{ id, paymentDate, referenceNumber, unapplied }>
 *                             // oldest-first, after refunds consumed
 * }>>}
 */
export async function loadTenantCreditByProperty({ tenantId, propertyId = null }) {
  const tenant = toNumber(tenantId);
  const property = propertyId === null || propertyId === undefined
    ? null
    : toNumber(propertyId);
  const result = new Map();
  if (!tenant || tenant <= 0) return result;
  if (propertyId !== null && propertyId !== undefined && !property) return result;

  const [paymentRows, refundRows] = await Promise.all([
    sql(
      `
        SELECT
          p.id,
          p.property_id,
          p.payment_date,
          p.reference_number,
          (p.amount - COALESCE(SUM(pia.amount_applied), 0))::numeric AS unapplied
        FROM payments p
        LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
        WHERE COALESCE(p.is_reversed, false) = false
          -- Pending payments are not credit until an Admin approves them
          -- (NULL = legacy row from before approvals, treated as approved).
          AND COALESCE(p.approval_status, 'approved') = 'approved'
          AND p.tenant_id = $1::int
          AND p.property_id IS NOT NULL
          AND ($2::int IS NULL OR p.property_id = $2::int)
        GROUP BY p.id
        HAVING (p.amount - COALESCE(SUM(pia.amount_applied), 0)) > 0
        ORDER BY p.payment_date ASC, p.id ASC
      `,
      [tenant, property],
    ),
    sql(
      `
        SELECT u.property_id, COALESCE(SUM(t.amount), 0)::numeric AS refunded
        FROM transactions t
        JOIN leases l ON l.id = t.source_id
        JOIN units u ON u.id = l.unit_id
        WHERE t.source_type IN ('prepayment_refund', 'prepayment_writeoff')
          AND COALESCE(t.is_deleted, false) = false
          AND l.tenant_id = $1::int
          AND ($2::int IS NULL OR u.property_id = $2::int)
        GROUP BY u.property_id
      `,
      [tenant, property],
    ),
  ]);

  const entryFor = (pid) => {
    if (!result.has(pid)) {
      result.set(pid, {
        propertyId: pid,
        grossUnapplied: 0,
        refunded: 0,
        balance: 0,
        payments: [],
      });
    }
    return result.get(pid);
  };

  for (const r of paymentRows || []) {
    const e = entryFor(Number(r.property_id));
    const unapplied = Number(r.unapplied || 0);
    e.grossUnapplied += unapplied;
    e.payments.push({
      id: Number(r.id),
      paymentDate: r.payment_date,
      referenceNumber: r.reference_number,
      unapplied,
    });
  }

  for (const r of refundRows || []) {
    const e = entryFor(Number(r.property_id));
    e.refunded += Number(r.refunded || 0);
  }

  for (const e of result.values()) {
    // Refunds/write-offs consume the oldest credit first.
    let toConsume = e.refunded;
    for (const pay of e.payments) {
      if (toConsume <= 0) break;
      const take = Math.min(pay.unapplied, toConsume);
      pay.unapplied = round2(pay.unapplied - take);
      toConsume = round2(toConsume - take);
    }
    e.payments = e.payments.filter((pay) => pay.unapplied > 0);
    e.grossUnapplied = round2(e.grossUnapplied);
    e.refunded = round2(e.refunded);
    e.balance = Math.max(0, round2(e.grossUnapplied - e.refunded));
  }

  return result;
}

/**
 * Remaining prepayment credit for one tenant at one property.
 * This is the amount shown and posted when a lease at that property ends.
 */
export async function getPropertyPrepaymentBalance({ tenantId, propertyId }) {
  if (!toNumber(tenantId) || !toNumber(propertyId)) {
    throw new Error(
      "getPropertyPrepaymentBalance requires both tenantId and propertyId",
    );
  }
  const map = await loadTenantCreditByProperty({ tenantId, propertyId });
  return map.get(Number(propertyId))?.balance || 0;
}
