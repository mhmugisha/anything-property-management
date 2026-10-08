import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import {
  ensureCanCreditAccount,
  ensureNotManuallyLocked,
  getAccountIdByCode,
  getLeaseDepositBalance,
  getTenantPrepaymentBalance,
} from "@/app/api/utils/accounting";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Refunds go out of the same cash/bank accounts the termination preview offers.
const REFUND_ACCOUNT_CODES = ["1110", "1120"];

// Every guarded statement below only takes effect while the lease is still
// active. The lease row is locked first and flipped to 'ended' last, so a
// second concurrent submit waits, then sees 'ended' and writes nothing.
const LEASE_ACTIVE = (n) =>
  `EXISTS (SELECT 1 FROM leases WHERE id = $${n}::int AND status = 'active')`;

/**
 * Validates a user-chosen account for this settlement: it must exist, be
 * active, have the expected type (and code, for refunds), and not be locked
 * to manual posting. Returns null when fine, or { status, body } to send.
 */
async function checkChosenAccount(accountId, { type, codes, label }) {
  const rows = await sql`
    SELECT id, account_code, account_type, is_active
    FROM chart_of_accounts
    WHERE id = ${accountId}
    LIMIT 1
  `;
  const acct = rows?.[0];
  if (
    !acct ||
    acct.is_active === false ||
    (acct.account_type || "").trim() !== type ||
    (codes && !codes.includes(String(acct.account_code)))
  ) {
    return { status: 400, body: { error: `Invalid ${label}` } };
  }

  const lock = await ensureNotManuallyLocked({ creditAccountId: accountId });
  if (!lock.ok) return { status: lock.status, body: lock.body };

  return null;
}

export async function POST(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tenantId = Number(id);
    if (!tenantId) {
      return Response.json({ error: "Invalid tenant id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const today = new Date().toISOString().slice(0, 10);
    const terminationDate = parseDate(body?.termination_date) || today;
    const [termYear, termMonth] = terminationDate.split("-").map(Number);
    const termYM = termYear * 100 + termMonth;

    const invoiceHandling = Array.isArray(body?.invoice_handling)
      ? body.invoice_handling
      : [];
    const depositSettlement = body?.deposit_settlement || null;
    const prepaymentHandling = body?.prepayment_handling || null;

    const explicitVoidIds = invoiceHandling
      .filter((h) => h.action === "void")
      .map((h) => toNumber(h.invoice_id))
      .filter(Boolean);

    const explicitKeepIds = invoiceHandling
      .filter((h) => h.action === "keep")
      .map((h) => toNumber(h.invoice_id))
      .filter(Boolean);

    // ── Which lease ─────────────────────────────────────────────────────────
    // End the lease the user clicked. Without lease_id, fall back to the
    // tenant's active lease only when there is exactly one.
    const requestedLeaseId = toNumber(body?.lease_id);
    let lease = null;
    if (requestedLeaseId) {
      const rows = await sql`
        SELECT * FROM leases
        WHERE id = ${requestedLeaseId}
          AND tenant_id = ${tenantId}
          AND status = 'active'
        LIMIT 1
      `;
      lease = rows?.[0] || null;
      if (!lease) {
        return Response.json(
          {
            error:
              "This lease is not active for this tenant (it may already have ended)",
          },
          { status: 409 },
        );
      }
    } else {
      const rows = await sql`
        SELECT * FROM leases
        WHERE tenant_id = ${tenantId} AND status = 'active'
        ORDER BY start_date DESC
      `;
      if (!rows?.length) {
        return Response.json(
          { error: "No active lease found for this tenant" },
          { status: 400 },
        );
      }
      if (rows.length > 1) {
        return Response.json(
          {
            error:
              "This tenant has more than one active lease — specify lease_id",
          },
          { status: 400 },
        );
      }
      lease = rows[0];
    }

    const leaseId = Number(lease.id);

    const [
      prepaymentAcctId,
      depositPayableAcctId,
      retainedEarningsAcctId,
      acct2100Id,
      acct1210Id,
    ] = await Promise.all([
      getAccountIdByCode("2150"),
      getAccountIdByCode("2200"),
      getAccountIdByCode("3200"),
      getAccountIdByCode("2100"),
      getAccountIdByCode("1210"),
    ]);

    const tenantRow = await sql`
      SELECT full_name FROM tenants WHERE id = ${tenantId} LIMIT 1
    `;
    const tenantName = tenantRow?.[0]?.full_name || "Tenant";

    // ── Prepayment (server-computed, same helper as the preview) ───────────
    const prepaymentBalance =
      prepaymentHandling && prepaymentAcctId
        ? await getTenantPrepaymentBalance(tenantId)
        : 0;
    const prepaymentAction = prepaymentHandling?.action;
    const prepaymentTxnDate =
      parseDate(prepaymentHandling?.transaction_date) || terminationDate;
    const prepayRefundAccountId =
      prepaymentAction === "refund"
        ? toNumber(prepaymentHandling?.refund_account_id)
        : null;
    const postPrepayRefund =
      prepaymentAcctId &&
      prepaymentBalance > 0 &&
      prepaymentAction === "refund" &&
      !!prepayRefundAccountId;
    const postPrepayWriteoff =
      prepaymentAcctId &&
      prepaymentBalance > 0 &&
      prepaymentAction === "writeoff" &&
      !!retainedEarningsAcctId;

    // ── Deposit (server-computed, same helper as the preview) ──────────────
    const depositBalance =
      depositSettlement && depositPayableAcctId
        ? await getLeaseDepositBalance(leaseId)
        : 0;

    const rawDeduction = toNumber(depositSettlement?.deduction_amount);
    if (rawDeduction !== null && rawDeduction < 0) {
      return Response.json(
        { error: "Deposit deduction cannot be negative" },
        { status: 400 },
      );
    }
    const deductionAmount = rawDeduction || 0;
    if (deductionAmount > depositBalance) {
      return Response.json(
        {
          error: `Deposit deduction (${deductionAmount}) exceeds the deposit held for this lease (${depositBalance})`,
        },
        { status: 400 },
      );
    }

    // The refund is whatever the deduction leaves — derived here, not taken
    // from the client.
    const netRefund = depositSettlement ? depositBalance - deductionAmount : 0;
    const clientNetRefund = toNumber(depositSettlement?.net_refund);
    if (
      clientNetRefund !== null &&
      Math.abs(clientNetRefund - netRefund) > 0.005
    ) {
      console.warn("end-lease: client net_refund differs from server value", {
        leaseId,
        clientNetRefund,
        serverNetRefund: netRefund,
      });
    }

    const depositTxnDate =
      parseDate(depositSettlement?.transaction_date) || terminationDate;
    const refundAccountId = toNumber(depositSettlement?.refund_account_id);
    const deductionIncomeAccountId = toNumber(
      depositSettlement?.deduction_income_account_id,
    );
    const deductionDescription = String(
      depositSettlement?.deduction_description || "Tenant deposit deduction",
    ).trim();
    const postDepositRefund =
      depositPayableAcctId && netRefund > 0 && !!refundAccountId;
    const postDepositForfeit =
      depositPayableAcctId && deductionAmount > 0 && !!deductionIncomeAccountId;

    // ── User-chosen accounts: type, lock and available-funds checks ────────
    // Only the accounts the user picks are checked. The fixed system accounts
    // (2100, 1210, 2200, 2150, 3200) are not: 2100 is manual-locked and the
    // rent_reversal rows to it are legitimate.
    const refundTotals = new Map();
    if (postDepositRefund) {
      const err = await checkChosenAccount(refundAccountId, {
        type: "Asset",
        codes: REFUND_ACCOUNT_CODES,
        label: "deposit refund account",
      });
      if (err) return Response.json(err.body, { status: err.status });
      refundTotals.set(refundAccountId, netRefund);
    }
    if (postPrepayRefund) {
      const err = await checkChosenAccount(prepayRefundAccountId, {
        type: "Asset",
        codes: REFUND_ACCOUNT_CODES,
        label: "prepayment refund account",
      });
      if (err) return Response.json(err.body, { status: err.status });
      refundTotals.set(
        prepayRefundAccountId,
        (refundTotals.get(prepayRefundAccountId) || 0) + prepaymentBalance,
      );
    }
    if (postDepositForfeit) {
      const err = await checkChosenAccount(deductionIncomeAccountId, {
        type: "Income",
        label: "deposit deduction income account",
      });
      if (err) return Response.json(err.body, { status: err.status });
    }
    for (const [creditAccountId, amount] of refundTotals) {
      const guard = await ensureCanCreditAccount({ creditAccountId, amount });
      if (!guard.ok) {
        return Response.json(guard.body, { status: guard.status });
      }
    }

    // Fetch the invoices that will be voided/written off by step 2 (same
    // WHERE clauses as steps 2a + 2b) along with their property/landlord info,
    // so we can post reversing GL entries that keep the landlord statement in
    // sync with the Payment Note. We capture paid_amount so the reversing entry
    // can use the OUTSTANDING amount (amount - paid_amount) for partially paid
    // invoices that were explicitly voided.
    const voidedInvoiceRows = await sql(
      `SELECT i.id, i.amount, i.paid_amount, i.property_id, i.invoice_year, i.invoice_month,
              p.landlord_id, u.id AS unit_id
       FROM invoices i
       LEFT JOIN properties p ON p.id = i.property_id
       LEFT JOIN units u ON u.id = i.unit_id
       WHERE i.lease_id = $1
         AND i.status <> 'paid'
         AND NOT i.id = ANY($4::int[])
         AND COALESCE(i.is_deleted, false) = false
         AND (
           (i.paid_amount = 0 AND (i.invoice_year * 100 + i.invoice_month > $2 OR i.id = ANY($3::int[])))
           OR
           (i.paid_amount > 0 AND i.id = ANY($3::int[]))
         )`,
      [leaseId, termYM, explicitVoidIds, explicitKeepIds],
    );

    // ── One atomic transaction: lock, guarded writes, flip lease last ──────
    const ops = [
      // Lock the lease so concurrent submits serialise.
      sql(`SELECT id FROM leases WHERE id = $1 FOR UPDATE`, [leaseId]),

      // Mark unit vacant
      lease.unit_id
        ? sql(
            `UPDATE units SET status = 'vacant'
             WHERE id = $1 AND ${LEASE_ACTIVE(2)}`,
            [Number(lease.unit_id), leaseId],
          )
        : sql`SELECT 1`,

      // 2a: void fully unpaid invoices after termination month + explicit voids (skip explicit keeps)
      sql(
        `UPDATE invoices
         SET status = 'void', is_deleted = true, voided_at_termination = true
         WHERE lease_id = $1
           AND paid_amount = 0
           AND status <> 'paid'
           AND (invoice_year * 100 + invoice_month > $2 OR id = ANY($3::int[]))
           AND NOT id = ANY($4::int[])
           AND ${LEASE_ACTIVE(1)}`,
        [leaseId, termYM, explicitVoidIds, explicitKeepIds],
      ),

      // 2b: write off partially paid invoices that were explicitly voided.
      // Preserve the paid portion and write off only the outstanding balance
      // by setting amount = paid_amount, so the invoice shows fully paid with
      // zero outstanding (rather than deleting it entirely).
      // Edit floor: use GREATEST(paid_amount, live_applied) so the write
      // never lands below the true allocated amount even if paid_amount
      // has drifted low.
      sql(
        `UPDATE invoices i
         SET amount = GREATEST(i.paid_amount, COALESCE((
               SELECT SUM(pia.amount_applied)
               FROM payment_invoice_allocations pia
               JOIN payments p ON p.id = pia.payment_id
               WHERE pia.invoice_id = i.id
                 AND p.is_reversed = false
                 AND COALESCE(p.approval_status, 'approved') = 'approved'
             ), 0)),
             status = 'paid'
         WHERE i.lease_id = $1
           AND i.paid_amount > 0
           AND i.status <> 'paid'
           AND i.id = ANY($2::int[])
           AND NOT i.id = ANY($3::int[])
           AND ${LEASE_ACTIVE(1)}`,
        [leaseId, explicitVoidIds, explicitKeepIds],
      ),

      // 2c: post reversing GL entries for voided/written-off invoices (Dr 2100 / Cr 1210)
      // using the OUTSTANDING amount (amount - paid_amount) so the landlord
      // statement stays in sync with the Payment Note for both fully unpaid
      // and partially paid invoices.
      ...voidedInvoiceRows
        .filter(
          (r) =>
            Number(r.amount) - Number(r.paid_amount) > 0 &&
            r.property_id &&
            r.landlord_id,
        )
        .map((r) =>
          sql(
            `INSERT INTO transactions (
               transaction_date, description,
               debit_account_id, credit_account_id,
               amount, currency, created_by,
               source_type, source_id,
               property_id, landlord_id,
               approval_status
             )
             SELECT
               $1::date, $2,
               $3, $4,
               $5, 'UGX', $6,
               'rent_reversal', $7,
               $8, $9,
               'approved'
             WHERE ${LEASE_ACTIVE(10)}`,
            [
              terminationDate,
              `Rent invoice reversal - lease termination - ${tenantName}`,
              acct2100Id,
              acct1210Id,
              Number(r.amount) - Number(r.paid_amount),
              perm.staff.id,
              Number(r.id),
              Number(r.property_id),
              Number(r.landlord_id),
              leaseId,
            ],
          ),
        ),

      // 3: resolve open review flags
      sql(
        `UPDATE lease_review_flags
         SET resolved_at = NOW(),
             resolved_by = $1,
             resolution_note = 'Lease manually ended'
         WHERE lease_id = $2 AND resolved_at IS NULL
           AND ${LEASE_ACTIVE(2)}`,
        [perm.staff.id, leaseId],
      ),
    ];

    // 4: deposit refund GL entry
    if (postDepositRefund) {
      ops.push(
        sql(
          `INSERT INTO transactions (
             transaction_date, description, reference_number,
             debit_account_id, credit_account_id,
             amount, currency, created_by,
             source_type, source_id, approval_status
           )
           SELECT $1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'security_deposit_refund', $8, 'approved'
           WHERE ${LEASE_ACTIVE(8)}`,
          [
            depositTxnDate,
            `Security deposit refund - ${tenantName}`,
            `SD-REFUND-${leaseId}`,
            depositPayableAcctId,
            refundAccountId,
            netRefund,
            perm.staff.id,
            leaseId,
          ],
        ),
      );
    }

    // 5: deposit forfeiture GL entry
    if (postDepositForfeit) {
      ops.push(
        sql(
          `INSERT INTO transactions (
             transaction_date, description, reference_number,
             debit_account_id, credit_account_id,
             amount, currency, created_by,
             source_type, source_id, approval_status
           )
           SELECT $1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'security_deposit_forfeiture', $8, 'approved'
           WHERE ${LEASE_ACTIVE(8)}`,
          [
            depositTxnDate,
            `${deductionDescription} - ${tenantName}`,
            `SD-FORFEIT-${leaseId}`,
            depositPayableAcctId,
            deductionIncomeAccountId,
            deductionAmount,
            perm.staff.id,
            leaseId,
          ],
        ),
      );
    }

    // 6: prepayment GL entry
    if (postPrepayRefund) {
      ops.push(
        sql(
          `INSERT INTO transactions (
             transaction_date, description, reference_number,
             debit_account_id, credit_account_id,
             amount, currency, created_by,
             source_type, source_id, approval_status
           )
           SELECT $1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'prepayment_refund', $8, 'approved'
           WHERE ${LEASE_ACTIVE(8)}`,
          [
            prepaymentTxnDate,
            `Prepayment refund - ${tenantName}`,
            `PREPAY-REFUND-${leaseId}`,
            prepaymentAcctId,
            prepayRefundAccountId,
            prepaymentBalance,
            perm.staff.id,
            leaseId,
          ],
        ),
      );
    } else if (postPrepayWriteoff) {
      ops.push(
        sql(
          `INSERT INTO transactions (
             transaction_date, description, reference_number,
             debit_account_id, credit_account_id,
             amount, currency, created_by,
             source_type, source_id, approval_status
           )
           SELECT $1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'prepayment_writeoff', $8, 'approved'
           WHERE ${LEASE_ACTIVE(8)}`,
          [
            prepaymentTxnDate,
            `Prepayment write-off - ${tenantName}`,
            `PREPAY-WRITEOFF-${leaseId}`,
            prepaymentAcctId,
            retainedEarningsAcctId,
            prepaymentBalance,
            perm.staff.id,
            leaseId,
          ],
        ),
      );
    }

    // Last: end the lease. If it was already ended, every guarded statement
    // above was a no-op and this returns no row.
    ops.push(
      sql(
        `UPDATE leases
         SET status = 'ended',
             auto_renew = false,
             end_date = CASE WHEN end_date > $1::date THEN $1::date ELSE end_date END
         WHERE id = $2 AND status = 'active'
         RETURNING id`,
        [terminationDate, leaseId],
      ),
    );

    const results = await sql.transaction(ops);
    const endedRows = results[results.length - 1];
    if (!endedRows?.length) {
      return Response.json({ error: "Lease already ended" }, { status: 409 });
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "lease.end",
      entityType: "lease",
      entityId: leaseId,
      oldValues: lease,
      newValues: { status: "ended", end_date: terminationDate },
      ipAddress: perm.ipAddress,
    });

    const depositSettled = Boolean(
      depositPayableAcctId &&
      depositSettlement &&
      (netRefund > 0 || deductionAmount > 0),
    );
    const prepaymentHandled = Boolean(postPrepayRefund || postPrepayWriteoff);

    return Response.json({
      success: true,
      lease_id: leaseId,
      termination_date: terminationDate,
      invoices_voided: explicitVoidIds,
      invoices_kept: explicitKeepIds,
      deposit_settled: depositSettled,
      deposit_refund_amount: netRefund,
      prepayment_handled: prepaymentHandled,
      prepayment_action: prepaymentHandling?.action || null,
    });
  } catch (error) {
    console.error("POST /api/tenants/[id]/end-lease error", error);
    return Response.json({ error: "Failed to end lease" }, { status: 500 });
  }
}
