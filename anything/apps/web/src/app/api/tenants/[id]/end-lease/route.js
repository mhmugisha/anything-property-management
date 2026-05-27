import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

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

    const leaseRows = await sql`
      SELECT * FROM leases
      WHERE tenant_id = ${tenantId} AND status = 'active'
      ORDER BY start_date DESC LIMIT 1
    `;

    const lease = leaseRows?.[0] || null;
    if (!lease) {
      return Response.json(
        { error: "No active lease found for this tenant" },
        { status: 400 },
      );
    }

    const leaseId = Number(lease.id);

    const [prepaymentAcctId, depositPayableAcctId, retainedEarningsAcctId] =
      await Promise.all([
        getAccountIdByCode("2150"),
        getAccountIdByCode("2200"),
        getAccountIdByCode("3200"),
      ]);

    const tenantRow = await sql`
      SELECT full_name FROM tenants WHERE id = ${tenantId} LIMIT 1
    `;
    const tenantName = tenantRow?.[0]?.full_name || "Tenant";

    // Compute prepayment balance before the transaction (needed to size the INSERT)
    let prepaymentBalance = 0;
    if (prepaymentHandling && prepaymentAcctId) {
      const balRows = await sql(
        `SELECT
           COALESCE(SUM(CASE WHEN t.credit_account_id = $1 THEN t.amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN t.debit_account_id = $1 THEN t.amount ELSE 0 END), 0)
           AS balance
         FROM transactions t
         LEFT JOIN payments pm
           ON pm.id = t.source_id
           AND t.source_type IN ('payment', 'payment_advance')
         LEFT JOIN leases l_src
           ON l_src.id = t.source_id
           AND t.source_type IN ('prepayment_refund', 'prepayment_writeoff')
         WHERE (t.debit_account_id = $1 OR t.credit_account_id = $1)
           AND COALESCE(t.is_deleted, false) = false
           AND (pm.tenant_id = $2 OR l_src.tenant_id = $2)`,
        [prepaymentAcctId, tenantId],
      );
      prepaymentBalance = Number(balRows?.[0]?.balance || 0);
    }

    // Build transaction operations
    const txOps = (txn) => {
      const ops = [
        // 0: end the lease
        txn(
          `UPDATE leases
           SET status = 'ended',
               auto_renew = false,
               end_date = CASE WHEN end_date > $1::date THEN $1::date ELSE end_date END
           WHERE id = $2`,
          [terminationDate, leaseId],
        ),

        // 1: mark unit vacant
        lease.unit_id
          ? txn(
              `UPDATE units SET status = 'vacant' WHERE id = $1`,
              [Number(lease.unit_id)],
            )
          : txn`SELECT 1`,

        // 2: void invoices after termination month + explicit voids (skip explicit keeps)
        txn(
          `UPDATE invoices
           SET status = 'void'
           WHERE lease_id = $1
             AND paid_amount = 0
             AND status <> 'paid'
             AND (invoice_year * 100 + invoice_month > $2 OR id = ANY($3::int[]))
             AND NOT id = ANY($4::int[])`,
          [leaseId, termYM, explicitVoidIds, explicitKeepIds],
        ),

        // 3: resolve open review flags
        txn(
          `UPDATE lease_review_flags
           SET resolved_at = NOW(),
               resolved_by = $1,
               resolution_note = 'Lease manually ended'
           WHERE lease_id = $2 AND resolved_at IS NULL`,
          [perm.staff.id, leaseId],
        ),
      ];

      // 4: deposit refund GL entry
      const depositTxnDate =
        parseDate(depositSettlement?.transaction_date) || terminationDate;
      const netRefund = toNumber(depositSettlement?.net_refund) || 0;
      const deductionAmount = toNumber(depositSettlement?.deduction_amount) || 0;
      const refundAccountId = toNumber(depositSettlement?.refund_account_id);
      const deductionIncomeAccountId = toNumber(
        depositSettlement?.deduction_income_account_id,
      );
      const deductionDescription = String(
        depositSettlement?.deduction_description || "Tenant deposit deduction",
      ).trim();

      if (depositPayableAcctId && netRefund > 0 && refundAccountId) {
        ops.push(
          txn(
            `INSERT INTO transactions (
               transaction_date, description, reference_number,
               debit_account_id, credit_account_id,
               amount, currency, created_by,
               source_type, source_id, approval_status
             ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'security_deposit_refund', $8, 'approved')`,
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
      if (depositPayableAcctId && deductionAmount > 0 && deductionIncomeAccountId) {
        ops.push(
          txn(
            `INSERT INTO transactions (
               transaction_date, description, reference_number,
               debit_account_id, credit_account_id,
               amount, currency, created_by,
               source_type, source_id, approval_status
             ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'security_deposit_forfeiture', $8, 'approved')`,
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
      const prepaymentTxnDate =
        parseDate(prepaymentHandling?.transaction_date) || terminationDate;
      const prepaymentAction = prepaymentHandling?.action;

      if (prepaymentAcctId && prepaymentBalance > 0) {
        if (prepaymentAction === "refund") {
          const prepayRefundAccountId = toNumber(
            prepaymentHandling?.refund_account_id,
          );
          if (prepayRefundAccountId) {
            ops.push(
              txn(
                `INSERT INTO transactions (
                   transaction_date, description, reference_number,
                   debit_account_id, credit_account_id,
                   amount, currency, created_by,
                   source_type, source_id, approval_status
                 ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'prepayment_refund', $8, 'approved')`,
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
          }
        } else if (prepaymentAction === "writeoff" && retainedEarningsAcctId) {
          ops.push(
            txn(
              `INSERT INTO transactions (
                 transaction_date, description, reference_number,
                 debit_account_id, credit_account_id,
                 amount, currency, created_by,
                 source_type, source_id, approval_status
               ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'prepayment_writeoff', $8, 'approved')`,
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
      }

      return ops;
    };

    await sql.transaction(txOps);

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

    // Re-read these in closure scope for the response
    const _netRefund = toNumber(depositSettlement?.net_refund) || 0;
    const _deductionAmount =
      toNumber(depositSettlement?.deduction_amount) || 0;
    const prepaymentHandled =
      prepaymentBalance > 0 &&
      Boolean(
        prepaymentHandling?.action === "refund"
          ? prepaymentHandling?.refund_account_id
          : prepaymentHandling?.action === "writeoff",
      );

    return Response.json({
      success: true,
      lease_id: leaseId,
      termination_date: terminationDate,
      invoices_voided: explicitVoidIds,
      invoices_kept: explicitKeepIds,
      deposit_settled: depositSettled,
      deposit_refund_amount: _netRefund,
      prepayment_handled: prepaymentHandled,
      prepayment_action: prepaymentHandling?.action || null,
    });
  } catch (error) {
    console.error("POST /api/tenants/[id]/end-lease error", error);
    return Response.json({ error: "Failed to end lease" }, { status: 500 });
  }
}
