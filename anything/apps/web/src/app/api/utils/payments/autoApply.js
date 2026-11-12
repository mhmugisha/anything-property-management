import sql from "@/app/api/utils/sql";
import { createArrearsRecoveryFee } from "@/app/api/utils/payments/arrearsFeesHandler";
import { loadTenantCreditByProperty } from "@/app/api/utils/payments/tenantCredit";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { writeAuditLog } from "@/app/api/utils/staff";

// Credit never crosses properties: a payment is only ever paired with invoices
// where invoices.property_id = payments.property_id. Payments with a NULL
// property_id are never auto-applied. Refunds/write-offs already posted for a
// property consume that property's oldest credit first (see tenantCredit.js).
// Only APPROVED payments are credit and only APPROVED invoices are paid from
// it (NULL approval_status = legacy row, treated as approved); approving a
// pending payment or invoice re-runs auto-apply for that tenant.

// Namespace for pg_advisory_xact_lock(ns, tenant_id). Every auto-apply for a
// tenant serialises here, so two runs can never spend the same credit.
// (41130 = unit lock, 41131 = payroll run lock.)
export const TENANT_CREDIT_LOCK_NAMESPACE = 41132;

// Runs as the 2nd statement of the batch, i.e. with a snapshot taken AFTER the
// tenant lock. $1 tenant id, $2 plan (jsonb [{seq, payment_id, invoice_id,
// amount}], oldest-first), $3 debit account (tenant_prepayments), $4 credit
// account (tenant_receivable).
//
// Guards (never over-apply):
//   * invoice remaining is read with FOR UPDATE (latest committed value, row
//     held until commit) and must still be open / approved / same tenant;
//   * payment available credit is recomputed exactly as tenantCredit.js does
//     (amount − allocations, minus the property's refunds/write-offs consumed
//     oldest-first); payments are row-locked and must still be approved and
//     not reversed;
//   * each pair applies LEAST(planned, invoice remaining − planned earlier on
//     that invoice, payment available − planned earlier from that payment),
//     floored at 0. Without concurrency this is exactly the plan; with it,
//     a pair is reduced or skipped, never increased.
// GL: one 'payment_auto_apply' row per allocation (source_id = allocation id,
// what allocationCleanup.js soft-deletes), whose amount is set to the
// allocation's TOTAL amount_applied after this write — so re-applying the same
// payment/invoice pair no longer leaves the GL at only the last increment.
const AUTO_APPLY_WRITE_QUERY = `
  WITH plan AS (
    SELECT (e->>'seq')::int         AS seq,
           (e->>'payment_id')::int  AS payment_id,
           (e->>'invoice_id')::int  AS invoice_id,
           (e->>'amount')::numeric  AS planned
    FROM jsonb_array_elements($2::jsonb) e
  ),
  inv AS (
    SELECT i.id, i.property_id, (i.amount - i.paid_amount) AS remaining,
           i.currency, i.description
    FROM invoices i
    WHERE i.id IN (SELECT invoice_id FROM plan)
      AND i.tenant_id = $1::int
      AND i.status = 'open'
      AND COALESCE(i.is_deleted, false) = false
      AND COALESCE(i.approval_status, 'approved') = 'approved'
      AND i.property_id IS NOT NULL
      AND (i.amount - i.paid_amount) > 0
    FOR UPDATE
  ),
  pay_lock AS (
    SELECT p.id
    FROM payments p
    WHERE p.id IN (SELECT payment_id FROM plan)
      AND p.tenant_id = $1::int
      AND COALESCE(p.is_reversed, false) = false
      AND COALESCE(p.approval_status, 'approved') = 'approved'
      AND p.property_id IS NOT NULL
    FOR UPDATE
  ),
  pay_gross AS (
    SELECT p.id, p.property_id, p.payment_date, p.reference_number,
           (p.amount - COALESCE(SUM(pia.amount_applied), 0))::numeric AS gross
    FROM payments p
    LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
    WHERE COALESCE(p.is_reversed, false) = false
      AND COALESCE(p.approval_status, 'approved') = 'approved'
      AND p.tenant_id = $1::int
      AND p.property_id IS NOT NULL
    GROUP BY p.id
    HAVING (p.amount - COALESCE(SUM(pia.amount_applied), 0)) > 0
  ),
  refunds AS (
    SELECT u.property_id, COALESCE(SUM(t.amount), 0)::numeric AS refunded
    FROM transactions t
    JOIN leases l ON l.id = t.source_id
    JOIN units u ON u.id = l.unit_id
    WHERE t.source_type IN ('prepayment_refund', 'prepayment_writeoff')
      AND COALESCE(t.is_deleted, false) = false
      AND l.tenant_id = $1::int
    GROUP BY u.property_id
  ),
  pay_avail AS (
    SELECT g.id, g.property_id, g.payment_date, g.reference_number,
           GREATEST(0, LEAST(
             g.gross,
             SUM(g.gross) OVER (
               PARTITION BY g.property_id
               ORDER BY g.payment_date ASC, g.id ASC
             ) - COALESCE(r.refunded, 0)
           )) AS avail
    FROM pay_gross g
    LEFT JOIN refunds r ON r.property_id = g.property_id
  ),
  guarded AS (
    SELECT pl.seq, pl.payment_id, pl.invoice_id, pl.planned,
           inv.remaining, pa.avail,
           COALESCE(SUM(pl.planned) OVER (
             PARTITION BY pl.invoice_id ORDER BY pl.seq
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ), 0) AS inv_before,
           COALESCE(SUM(pl.planned) OVER (
             PARTITION BY pl.payment_id ORDER BY pl.seq
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ), 0) AS pay_before
    FROM plan pl
    JOIN inv ON inv.id = pl.invoice_id
    JOIN pay_lock pk ON pk.id = pl.payment_id
    JOIN pay_avail pa ON pa.id = pl.payment_id
                     AND pa.property_id = inv.property_id
    WHERE pl.planned > 0
  ),
  ok AS (
    SELECT seq, payment_id, invoice_id,
           GREATEST(0, LEAST(planned,
                             remaining - inv_before,
                             avail - pay_before)) AS amount
    FROM guarded
  ),
  to_write AS (
    SELECT * FROM ok WHERE amount > 0
  ),
  alloc AS (
    INSERT INTO payment_invoice_allocations (payment_id, invoice_id, amount_applied)
    SELECT payment_id, invoice_id, amount FROM to_write
    ON CONFLICT (payment_id, invoice_id)
    DO UPDATE SET amount_applied = payment_invoice_allocations.amount_applied + EXCLUDED.amount_applied
    RETURNING id, payment_id, invoice_id, amount_applied
  ),
  written AS (
    SELECT al.id AS allocation_id, al.payment_id, al.invoice_id,
           al.amount_applied AS total_applied, w.amount AS applied, w.seq
    FROM alloc al
    JOIN to_write w ON w.payment_id = al.payment_id AND w.invoice_id = al.invoice_id
  ),
  inv_totals AS (
    SELECT invoice_id, SUM(applied) AS total FROM written GROUP BY invoice_id
  ),
  inv_upd AS (
    UPDATE invoices i
    SET paid_amount = i.paid_amount + s.total,
        status = CASE
          WHEN (i.paid_amount + s.total) >= i.amount THEN 'paid'
          ELSE 'open'
        END
    FROM inv_totals s
    WHERE i.id = s.invoice_id
      AND (i.amount - i.paid_amount) >= s.total
    RETURNING i.id
  ),
  gl_src AS (
    SELECT w.allocation_id, w.payment_id, w.invoice_id, w.total_applied,
           w.applied, w.seq,
           pa.payment_date, pa.reference_number,
           inv.property_id,
           pr.landlord_id,
           COALESCE(NULLIF(inv.currency, ''), 'UGX') AS currency,
           'Payment on Account Applied - '
             || COALESCE(NULLIF(tn.full_name, ''), 'Tenant')
             || ' - ' || COALESCE(NULLIF(inv.description, ''), 'Rent') AS descr,
           (SELECT t.id FROM transactions t
            WHERE t.source_type = 'payment_auto_apply'
              AND t.source_id = w.allocation_id
            ORDER BY COALESCE(t.is_deleted, false) ASC, t.id ASC
            LIMIT 1) AS existing_gl_id
    FROM written w
    JOIN inv ON inv.id = w.invoice_id
    JOIN pay_avail pa ON pa.id = w.payment_id
    LEFT JOIN properties pr ON pr.id = inv.property_id
    LEFT JOIN tenants tn ON tn.id = $1::int
  ),
  gl_upd AS (
    UPDATE transactions t
    SET transaction_date = g.payment_date::date,
        description = g.descr,
        reference_number = NULLIF(TRIM(g.reference_number), ''),
        debit_account_id = $3::int,
        credit_account_id = $4::int,
        amount = g.total_applied,
        currency = g.currency,
        created_by = NULL,
        landlord_id = g.landlord_id,
        property_id = g.property_id,
        is_deleted = false,
        deleted_at = NULL,
        deleted_by = NULL
    FROM gl_src g
    WHERE t.id = g.existing_gl_id
    RETURNING t.id, t.source_id
  ),
  gl_ins AS (
    INSERT INTO transactions (
      transaction_date, description, reference_number,
      debit_account_id, credit_account_id,
      amount, currency, created_by,
      landlord_id, property_id,
      source_type, source_id, is_deleted, approval_status
    )
    SELECT g.payment_date::date, g.descr, NULLIF(TRIM(g.reference_number), ''),
           $3::int, $4::int,
           g.total_applied, g.currency, NULL,
           g.landlord_id, g.property_id,
           'payment_auto_apply', g.allocation_id, false, 'approved'
    FROM gl_src g
    WHERE g.existing_gl_id IS NULL
    RETURNING id, source_id
  ),
  guard AS (
    -- Belt and braces: every invoice we allocated to must have been updated
    -- (it is row-locked above, so this only trips on a logic error). Casting
    -- a non-constant string to int aborts the whole batch.
    SELECT CASE
      WHEN (SELECT COUNT(*) FROM inv_upd) <> (SELECT COUNT(*) FROM inv_totals)
      THEN ('autoApply guard: invoice balance changed during write ('
            || (SELECT COUNT(*) FROM inv_upd) || '/'
            || (SELECT COUNT(*) FROM inv_totals) || ')')::int
      ELSE 0
    END AS ok
  )
  SELECT g.allocation_id, g.payment_id, g.invoice_id,
         g.applied, g.total_applied, g.payment_date,
         COALESCE(u.id, i.id) AS gl_id,
         CASE WHEN u.id IS NOT NULL THEN 'update' ELSE 'insert' END AS gl_posting,
         (SELECT ok FROM guard) AS guard_ok
  FROM gl_src g
  LEFT JOIN gl_upd u ON u.source_id = g.allocation_id
  LEFT JOIN gl_ins i ON i.source_id = g.allocation_id
  UNION ALL
  -- Always return at least one row so the guard is evaluated even when
  -- nothing was written.
  SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, (SELECT ok FROM guard)
  ORDER BY 1 NULLS LAST
`;

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

async function getTenantIdsWithUnappliedAndOpenInvoices(limit = 200) {
  const lim = Number(limit);
  const safeLimit = Number.isFinite(lim) && lim > 0 ? Math.min(lim, 2000) : 200;

  const query = `
    WITH payment_unapplied AS (
      SELECT
        p.tenant_id,
        p.property_id,
        (p.amount - COALESCE(SUM(pia.amount_applied), 0))::numeric AS unapplied
      FROM payments p
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      WHERE p.is_reversed = false
        AND COALESCE(p.approval_status, 'approved') = 'approved'
        AND p.tenant_id IS NOT NULL
        AND p.property_id IS NOT NULL
      GROUP BY p.id
      HAVING (p.amount - COALESCE(SUM(pia.amount_applied), 0)) > 0
    ),
    open_invoices AS (
      SELECT DISTINCT tenant_id, property_id
      FROM invoices
      WHERE status = 'open'
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND (amount - paid_amount) > 0
    )
    SELECT DISTINCT pu.tenant_id
    FROM payment_unapplied pu
    JOIN open_invoices oi
      ON oi.tenant_id = pu.tenant_id
     AND oi.property_id = pu.property_id
    ORDER BY pu.tenant_id
    LIMIT $1
  `;

  const rows = await sql(query, [safeLimit]);
  return (rows || []).map((r) => r.tenant_id).filter((id) => id !== null);
}

export async function autoApplyAdvancePaymentsForTenant(tenantId) {
  const tenantIdNum = toNumber(tenantId);
  if (!tenantIdNum) {
    return { ok: false, error: "Invalid tenantId" };
  }

  // Open invoices oldest-first
  const invoices = await sql(
    `
      SELECT i.id, i.amount, i.paid_amount,
             i.property_id, i.currency, i.description,
             p.landlord_id,
             t.full_name AS tenant_name
      FROM invoices i
      LEFT JOIN properties p ON p.id = i.property_id
      LEFT JOIN tenants t ON t.id = i.tenant_id
      WHERE i.tenant_id = $1
        AND i.status = 'open'
        AND COALESCE(i.is_deleted, false) = false
        -- Pending invoices are never paid from credit (NULL = legacy row).
        AND COALESCE(i.approval_status, 'approved') = 'approved'
        AND (i.amount - i.paid_amount) > 0
      ORDER BY i.invoice_date ASC, i.id ASC
    `,
    [tenantIdNum],
  );

  if (!invoices || invoices.length === 0) {
    return { ok: true, appliedCount: 0, appliedAmount: 0 };
  }

  // Remaining credit per property (oldest-first payments, refunds consumed).
  const creditByProperty = await loadTenantCreditByProperty({
    tenantId: tenantIdNum,
  });

  if (creditByProperty.size === 0) {
    return { ok: true, appliedCount: 0, appliedAmount: 0 };
  }

  // Build an allocation plan in JS. Each invoice only draws on credit from
  // payments at the SAME property.
  const allocations = [];

  for (const inv of invoices) {
    let remaining = Number(inv.amount || 0) - Number(inv.paid_amount || 0);
    if (remaining <= 0) continue;
    if (inv.property_id === null || inv.property_id === undefined) continue;

    const credit = creditByProperty.get(Number(inv.property_id));
    if (!credit) continue;

    for (const pay of credit.payments) {
      if (remaining <= 0) break;
      if (pay.unapplied <= 0) continue;

      const applyAmount = Math.min(remaining, pay.unapplied);
      if (applyAmount <= 0) continue;

      allocations.push({
        paymentId: pay.id,
        paymentDate: pay.paymentDate,
        referenceNumber: pay.referenceNumber,
        invoiceId: inv.id,
        amount: applyAmount,
        currency: inv.currency || "UGX",
        propertyId: inv.property_id,
        landlordId: inv.landlord_id,
        tenantName: inv.tenant_name,
        description: inv.description,
      });

      remaining -= applyAmount;
      pay.unapplied -= applyAmount;
    }
  }

  if (allocations.length === 0) {
    return { ok: true, appliedCount: 0, appliedAmount: 0 };
  }

  // Resolve GL accounts up front: the GL row is written inside the same
  // statement as the allocation, so an allocation can never exist without its
  // GL (or vice versa). If they can't be resolved, apply nothing.
  const [debitRes, creditRes] = await Promise.all([
    resolveAccountIntent("tenant_prepayments"),
    resolveAccountIntent("tenant_receivable"),
  ]);
  const debitAccountId = toNumber(debitRes?.accountId);
  const creditAccountId = toNumber(creditRes?.accountId);
  if (!debitRes?.ok || !creditRes?.ok || !debitAccountId || !creditAccountId) {
    console.error("autoApply: could not resolve GL accounts", {
      debit: debitRes?.error,
      credit: creditRes?.error,
    });
    return { ok: false, error: "Could not resolve auto-apply GL accounts" };
  }

  // The plan above was computed from a read taken BEFORE the lock, so another
  // auto-apply for this tenant (Payment on Account, bulk/cron run, approval)
  // may have spent some of the same credit or paid some of the same invoices
  // since. It is only an upper bound: the write re-checks everything.
  const plan = allocations.map((a, idx) => ({
    seq: idx,
    payment_id: Number(a.paymentId),
    invoice_id: Number(a.invoiceId),
    amount: Number(a.amount),
  }));

  try {
    const [, rows] = await sql.transaction([
      sql(`SELECT pg_advisory_xact_lock($1, $2)`, [
        TENANT_CREDIT_LOCK_NAMESPACE,
        tenantIdNum,
      ]),
      sql(AUTO_APPLY_WRITE_QUERY, [
        tenantIdNum,
        JSON.stringify(plan),
        debitAccountId,
        creditAccountId,
      ]),
    ]);

    const written = (rows || []).filter((r) => r.allocation_id !== null);
    if (written.length === 0) {
      return { ok: true, appliedCount: 0, appliedAmount: 0 };
    }

    const appliedAmount = written.reduce((sum, r) => sum + Number(r.applied || 0), 0);

    // Audit trail for the GL rows (best-effort, after commit — same action
    // name the posting adapter uses).
    await Promise.allSettled(
      written
        .filter((r) => r.gl_id)
        .map((r) =>
          writeAuditLog({
            staffId: null,
            action: "cil.accounting.upsert",
            entityType: "transaction",
            entityId: r.gl_id,
            oldValues: null,
            newValues: {
              amount: r.total_applied,
              source_type: "payment_auto_apply",
              source_id: r.allocation_id,
              cil: {
                debitIntent: "tenant_prepayments",
                creditIntent: "tenant_receivable",
                posting: r.gl_posting,
                increment: r.applied,
                source: {
                  sourceModule: "property",
                  businessEvent: "TENANT_ADVANCE_PAYMENT_AUTO_APPLIED",
                  sourceEntity: {
                    type: "payment",
                    id: r.payment_id,
                    invoiceId: r.invoice_id,
                  },
                },
              },
            },
            ipAddress: null,
          }),
        ),
    );

    // Arrears recovery fees, only for amounts actually written.
    await Promise.allSettled(
      written.map((r) =>
        createArrearsRecoveryFee({
          invoiceId: r.invoice_id,
          amountPaid: Number(r.applied),
          paymentDate: r.payment_date,
          staffId: null, // null for auto-apply
          allocationId: r.allocation_id,
        }),
      ),
    );

    return {
      ok: true,
      appliedCount: written.length,
      appliedAmount,
    };
  } catch (e) {
    console.error("autoApplyAdvancePaymentsForTenant transaction failed:", e);
    console.error("Error details:", e.message, e.stack);
    return {
      ok: false,
      error: e.message || "Failed to auto-apply advance payments",
    };
  }
}

export async function autoApplyAdvancePaymentsToOpenInvoices(options = {}) {
  try {
    const tenantId = options?.tenantId;
    if (tenantId) {
      const res = await autoApplyAdvancePaymentsForTenant(tenantId);
      return {
        ok: res.ok,
        tenantsProcessed: res.ok ? 1 : 0,
        appliedCount: res.appliedCount || 0,
        appliedAmount: res.appliedAmount || 0,
      };
    }

    const tenantIds = await getTenantIdsWithUnappliedAndOpenInvoices(
      options?.limit || 200,
    );

    let tenantsProcessed = 0;
    let appliedCount = 0;
    let appliedAmount = 0;

    // OPTIMIZATION: Process tenants in parallel batches instead of sequentially
    const BATCH_SIZE = 5; // Process 5 tenants at a time

    for (let i = 0; i < tenantIds.length; i += BATCH_SIZE) {
      const batch = tenantIds.slice(i, i + BATCH_SIZE);

      // Process this batch in parallel
      const results = await Promise.allSettled(
        batch.map((id) => autoApplyAdvancePaymentsForTenant(id)),
      );

      // Aggregate results
      for (const result of results) {
        tenantsProcessed += 1;
        if (result.status === "fulfilled" && result.value.ok) {
          appliedCount += Number(result.value.appliedCount || 0);
          appliedAmount += Number(result.value.appliedAmount || 0);
        } else if (result.status === "rejected") {
          console.error("Batch processing error:", result.reason);
        }
      }
    }

    return { ok: true, tenantsProcessed, appliedCount, appliedAmount };
  } catch (e) {
    console.error("autoApplyAdvancePaymentsToOpenInvoices failed", e);
    return { ok: false, error: "Failed to auto-apply advance payments" };
  }
}
