import sql from "@/app/api/utils/sql";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { createArrearsRecoveryFee } from "@/app/api/utils/payments/arrearsFeesHandler";

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
        (p.amount - COALESCE(SUM(pia.amount_applied), 0))::numeric AS unapplied
      FROM payments p
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      WHERE p.is_reversed = false
        AND p.tenant_id IS NOT NULL
      GROUP BY p.id
      HAVING (p.amount - COALESCE(SUM(pia.amount_applied), 0)) > 0
    ),
    open_invoices AS (
      SELECT DISTINCT tenant_id
      FROM invoices
      WHERE status = 'open'
        AND (amount - paid_amount) > 0
    )
    SELECT DISTINCT pu.tenant_id
    FROM payment_unapplied pu
    JOIN open_invoices oi ON oi.tenant_id = pu.tenant_id
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
        AND (i.amount - i.paid_amount) > 0
      ORDER BY i.invoice_date ASC, i.id ASC
    `,
    [tenantIdNum],
  );

  if (!invoices || invoices.length === 0) {
    return { ok: true, appliedCount: 0, appliedAmount: 0 };
  }

  // Payments with remaining unapplied amount (oldest-first)
  const payments = await sql(
    `
      SELECT
        p.id,
        p.amount,
        p.payment_date,
        p.reference_number,
        (p.amount - COALESCE(SUM(pia.amount_applied), 0))::numeric AS unapplied
      FROM payments p
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      WHERE p.is_reversed = false
        AND p.tenant_id = $1
      GROUP BY p.id
      HAVING (p.amount - COALESCE(SUM(pia.amount_applied), 0)) > 0
      ORDER BY p.payment_date ASC, p.id ASC
    `,
    [tenantIdNum],
  );

  if (!payments || payments.length === 0) {
    return { ok: true, appliedCount: 0, appliedAmount: 0 };
  }

  // Build an allocation plan in JS
  const paymentState = payments.map((p) => ({
    id: p.id,
    paymentDate: p.payment_date,
    referenceNumber: p.reference_number,
    unapplied: Number(p.unapplied || 0),
  }));

  const allocations = [];

  for (const inv of invoices) {
    let remaining = Number(inv.amount || 0) - Number(inv.paid_amount || 0);
    if (remaining <= 0) continue;

    for (const pay of paymentState) {
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

  const appliedAmount = allocations.reduce((sum, a) => sum + a.amount, 0);

  // Apply allocations in a transaction (best-effort)
  try {
    // STEP 1: Execute INSERT and UPDATE in transaction FIRST
    await sql.transaction((txn) => {
      const queries = [];

      for (const a of allocations) {
        // Insert allocation
        queries.push(
          txn`
            INSERT INTO payment_invoice_allocations (payment_id, invoice_id, amount_applied)
            VALUES (${a.paymentId}, ${a.invoiceId}, ${a.amount})
            ON CONFLICT (payment_id, invoice_id)
            DO UPDATE SET amount_applied = payment_invoice_allocations.amount_applied + EXCLUDED.amount_applied
          `,
        );

        // Update invoice
        queries.push(
          txn`
            UPDATE invoices
            SET paid_amount = paid_amount + ${a.amount},
                status = CASE
                  WHEN (paid_amount + ${a.amount}) >= amount THEN 'paid'
                  ELSE 'open'
                END
            WHERE id = ${a.invoiceId}
          `,
        );
      }

      return queries;
    });

    // STEP 2: THEN post accounting entries AFTER transaction commits
    const postPromises = allocations.map((a) => {
      const receiptDesc = `Payment on Account Applied - ${a.tenantName || "Tenant"} - ${a.description || "Rent"}`;

      return postAccountingEntryFromIntents({
        transactionDate: a.paymentDate,
        description: receiptDesc,
        referenceNumber: a.referenceNumber || null,
        debitIntent: "tenant_prepayments",
        creditIntent: "tenant_receivable",
        amount: a.amount,
        currency: a.currency,
        createdBy: null,
        landlordId: a.landlordId || null,
        propertyId: a.propertyId,
        sourceType: "payment_auto_apply",
        sourceId: a.paymentId,
        auditContext: {
          sourceModule: "property",
          businessEvent: "TENANT_ADVANCE_PAYMENT_AUTO_APPLIED",
          sourceEntity: {
            type: "payment",
            id: a.paymentId,
            invoiceId: a.invoiceId,
          },
        },
      });
    });

    const postResults = await Promise.allSettled(postPromises);

    // STEP 3: NEW - Process arrears recovery fees for each allocation
    const feePromises = allocations.map((a) => {
      return createArrearsRecoveryFee({
        invoiceId: a.invoiceId,
        amountPaid: a.amount,
        paymentDate: a.paymentDate,
        staffId: null, // null for auto-apply
      });
    });

    const feeResults = await Promise.allSettled(feePromises);

    return {
      ok: true,
      appliedCount: allocations.length,
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
