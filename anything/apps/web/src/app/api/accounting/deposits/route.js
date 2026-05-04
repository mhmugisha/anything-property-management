import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureCanCreditAccount } from "@/app/api/utils/accounting";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function getAccountIdByCode(code) {
  const rows = await sql(
    "SELECT id FROM chart_of_accounts WHERE account_code = $1 LIMIT 1",
    [String(code)],
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}

/**
 * GET /api/accounting/deposits
 *
 * List all deposit transactions with optional date filtering
 */
export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";

    let query = `
      SELECT 
        t.id,
        t.transaction_date,
        t.description,
        t.amount,
        t.currency,
        t.debit_account_id,
        da.account_code AS debit_account_code,
        da.account_name AS debit_account_name,
        t.created_at,
        s.full_name AS created_by_name,
        COUNT(dt.id)::int AS deposited_items_count
      FROM transactions t
      LEFT JOIN chart_of_accounts da ON da.id = t.debit_account_id
      LEFT JOIN staff_users s ON s.id = t.created_by
      LEFT JOIN transactions dt ON dt.deposited_by_transaction_id = t.id 
        AND COALESCE(dt.is_deleted, false) = false
      WHERE t.source_type = 'deposit'
        AND COALESCE(t.is_deleted, false) = false
    `;

    const params = [];
    let paramIndex = 1;

    if (from) {
      query += ` AND t.transaction_date >= $${paramIndex++}`;
      params.push(from);
    }

    if (to) {
      query += ` AND t.transaction_date <= $${paramIndex++}`;
      params.push(to);
    }

    query += `
      GROUP BY t.id, da.account_code, da.account_name, s.full_name
      ORDER BY t.transaction_date DESC, t.id DESC
    `;

    const deposits = await sql(query, params);

    return Response.json({
      deposits: deposits || [],
    });
  } catch (error) {
    console.error("GET /api/accounting/deposits error", error);
    return Response.json(
      { error: "Failed to fetch deposits" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const depositDate = (body?.deposit_date || "").trim();
    const description = (body?.description || "").trim();
    const depositToAccountId = toNumber(body?.deposit_to_account_id);

    // NEW: Accept transaction_ids (new flow) or payment_ids (legacy flow)
    const transactionIds = Array.isArray(body?.transaction_ids)
      ? body.transaction_ids.map(toNumber).filter(Boolean)
      : [];
    const paymentIds = Array.isArray(body?.payment_ids)
      ? body.payment_ids.map(toNumber).filter(Boolean)
      : [];

    if (!depositDate || !description || !depositToAccountId) {
      return Response.json(
        {
          error:
            "deposit_date, description, and deposit_to_account_id are required",
        },
        { status: 400 },
      );
    }

    if (transactionIds.length === 0 && paymentIds.length === 0) {
      return Response.json(
        { error: "Select at least one undeposited item" },
        { status: 400 },
      );
    }

    const approval = getApprovalFields(perm.staff);
    const undepositedFundsAccountId = await getAccountIdByCode("1130");
    if (!undepositedFundsAccountId) {
      return Response.json(
        { error: "Undeposited Funds (1130) account is not set up" },
        { status: 500 },
      );
    }

    // Handle NEW transaction-based deposit flow
    if (transactionIds.length > 0) {
      // Pre-validate: Ensure we can credit 1130
      const preCheckRows = await sql(
        `
        SELECT 
          COUNT(*)::int AS cnt,
          COALESCE(SUM(amount), 0)::numeric AS total
        FROM transactions
        WHERE id = ANY($1::int[])
          AND debit_account_id = $2::int
          AND COALESCE(is_deleted, false) = false
          AND deposited_by_transaction_id IS NULL
        `,
        [transactionIds, undepositedFundsAccountId],
      );

      const preCheck = preCheckRows?.[0];
      if (!preCheck || Number(preCheck.cnt) !== transactionIds.length) {
        return Response.json(
          {
            error:
              "Some selected items were already deposited or are invalid. Refresh and try again.",
          },
          { status: 409 },
        );
      }

      const total = Number(preCheck.total);
      if (total <= 0) {
        return Response.json(
          { error: "Total amount must be greater than zero" },
          { status: 400 },
        );
      }

      const guard = await ensureCanCreditAccount({
        creditAccountId: undepositedFundsAccountId,
        amount: total,
      });
      if (!guard.ok) {
        return Response.json(guard.body, { status: guard.status });
      }

      // Create deposit atomically using CTE
      const expectedCount = transactionIds.length;
      const query = `
        WITH selected AS (
          SELECT id, amount, currency
          FROM transactions
          WHERE id = ANY($1::int[])
            AND debit_account_id = $2::int
            AND COALESCE(is_deleted, false) = false
            AND deposited_by_transaction_id IS NULL
          FOR UPDATE
        ),
        agg AS (
          SELECT
            COUNT(*)::int AS cnt,
            COALESCE(SUM(amount), 0)::numeric AS total,
            COUNT(DISTINCT COALESCE(currency,'UGX'))::int AS currency_cnt,
            MAX(COALESCE(currency,'UGX')) AS currency
          FROM selected
        ),
        ins_deposit AS (
          INSERT INTO transactions (
            transaction_date, description, reference_number,
            debit_account_id, credit_account_id,
            amount, currency,
            created_by,
            source_type,
            approval_status, approved_by, approved_at
          )
          SELECT
            $3::date, $4, NULL,
            $5::int, $2::int,
            agg.total, agg.currency,
            $6::int,
            'deposit',
            $8, $9, $10::timestamptz
          FROM agg
          WHERE agg.cnt = $7::int
            AND agg.total > 0
            AND agg.currency_cnt <= 1
          RETURNING *
        ),
        stamp AS (
          UPDATE transactions t
          SET source_id = t.id
          FROM ins_deposit d
          WHERE t.id = d.id
          RETURNING t.id
        ),
        mark_deposited AS (
          UPDATE transactions t
          SET deposited_by_transaction_id = (SELECT id FROM ins_deposit)
          FROM selected s
          WHERE t.id = s.id
            AND EXISTS (SELECT 1 FROM ins_deposit)
          RETURNING t.id
        )
        SELECT
          (SELECT to_jsonb(d.*) FROM ins_deposit d) AS deposit_txn,
          (SELECT total FROM agg) AS amount,
          (SELECT currency FROM agg) AS currency,
          (SELECT cnt FROM agg) AS selected_cnt,
          (SELECT currency_cnt FROM agg) AS currency_cnt,
          (SELECT COALESCE(array_agg(id ORDER BY id), '{}'::int[]) FROM mark_deposited) AS marked_ids;
      `;

      const rows = await sql(query, [
        transactionIds,
        undepositedFundsAccountId,
        depositDate,
        description,
        depositToAccountId,
        perm.staff.id,
        expectedCount,
        approval.approval_status,
        approval.approved_by,
        approval.approved_at,
      ]);

      const r = rows?.[0];
      const depositTxn = r?.deposit_txn;

      if (!depositTxn) {
        const selectedCnt = Number(r?.selected_cnt || 0);
        const currencyCnt = Number(r?.currency_cnt || 0);

        if (currencyCnt > 1) {
          return Response.json(
            {
              error:
                "Selected items include multiple currencies. Deposit them separately.",
            },
            { status: 400 },
          );
        }

        if (selectedCnt !== expectedCount) {
          return Response.json(
            {
              error:
                "Some selected items were already deposited or are invalid. Refresh and try again.",
            },
            { status: 409 },
          );
        }

        return Response.json(
          { error: "Failed to create deposit" },
          { status: 500 },
        );
      }

      const markedIds = (r?.marked_ids || []).map((x) => Number(x));

      // CRITICAL VALIDATION: Verify all source transactions were marked
      if (markedIds.length !== expectedCount) {
        // This should never happen due to CTE atomicity, but check anyway
        console.error(
          `CRITICAL: Deposit ${depositTxn.id} created but only ${markedIds.length}/${expectedCount} transactions marked!`,
        );
        return Response.json(
          {
            error: `Deposit validation failed: expected to mark ${expectedCount} transactions but only marked ${markedIds.length}. Please contact support.`,
          },
          { status: 500 },
        );
      }

      await writeAuditLog({
        staffId: perm.staff.id,
        action: "accounting.deposit.create",
        entityType: "transaction",
        entityId: Number(depositTxn.id),
        oldValues: null,
        newValues: {
          ...depositTxn,
          transaction_ids: transactionIds,
        },
        ipAddress: perm.ipAddress,
      });

      if (approval.approval_status === "pending") {
        notifyAllAdminsAsync({
          title: "New Deposit Pending Approval",
          message: `New deposit of ${r?.currency || "UGX"} ${Number(r?.amount || 0).toLocaleString()} - ${description} is pending approval. Posted by ${perm.staff.full_name || "Staff"}`,
          type: "transaction",
          reference_id: depositTxn?.id,
          reference_type: "transaction",
        });
      }

      return Response.json({
        transaction: depositTxn,
        deposited_transaction_ids: markedIds,
        amount: Number(r?.amount || 0),
        currency: r?.currency || "UGX",
      });
    }

    // Handle LEGACY payment-based deposit flow (keep for backward compatibility)
    // NEW: Backfill missing ledger entries for older payments.
    // Some payments may exist in `payments` but have never been posted into the ledger,
    // which makes the 1130 balance look like 0 even though undeposited payments exist.
    // We insert the standard rent receipt only when missing.
    const rentReceivableAccountId = await getAccountIdByCode("1210");

    if (!rentReceivableAccountId) {
      return Response.json(
        { error: "Accounting accounts not set up correctly" },
        { status: 500 },
      );
    }

    await sql(
      `
      WITH selected AS (
        SELECT p.id, p.payment_date, p.amount, COALESCE(p.currency,'UGX') AS currency,
               p.reference_number, p.tenant_id, p.property_id
        FROM payments p
        WHERE p.id = ANY($1::int[])
          AND p.is_reversed = false
      ),
      missing AS (
        SELECT s.*,
          (SELECT t.id
           FROM transactions t
           WHERE COALESCE(t.is_deleted,false)=false
             AND t.source_type='payment'
             AND t.source_id=s.id
           LIMIT 1) AS existing_txn_id
        FROM selected s
      ),
      need AS (
        SELECT * FROM missing WHERE existing_txn_id IS NULL
      ),
      inv AS (
        SELECT
          n.*,
          i.description AS invoice_description,
          tn.full_name AS tenant_name,
          pr.landlord_id
        FROM need n
        LEFT JOIN LATERAL (
          SELECT i.*
          FROM payment_invoice_allocations pia
          JOIN invoices i ON i.id = pia.invoice_id
          WHERE pia.payment_id = n.id
          ORDER BY pia.id ASC
          LIMIT 1
        ) i ON true
        LEFT JOIN tenants tn ON tn.id = n.tenant_id
        LEFT JOIN properties pr ON pr.id = n.property_id
      ),
      ins_receipt AS (
        INSERT INTO transactions (
          transaction_date, description, reference_number,
          debit_account_id, credit_account_id,
          amount, currency,
          created_by,
          landlord_id, property_id,
          source_type, source_id,
          approval_status, approved_by, approved_at
        )
        SELECT
          inv.payment_date::date,
          ('Rent collection - ' || COALESCE(inv.tenant_name,'Tenant') || ' - ' || COALESCE(inv.invoice_description,'Rent')),
          inv.reference_number,
          $2::int, $3::int,
          inv.amount, inv.currency,
          $4::int,
          inv.landlord_id, inv.property_id,
          'payment', inv.id,
          $5, $6, $7::timestamptz
        FROM inv
        WHERE inv.amount > 0
        RETURNING id, source_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM need) AS backfilled_payment_count;
      `,
      [
        paymentIds,
        undepositedFundsAccountId,
        rentReceivableAccountId,
        perm.staff.id,
        approval.approval_status,
        approval.approved_by,
        approval.approved_at,
      ],
    );

    // Guard: don't allow crediting Undeposited Funds below zero.
    // This relies on 1130 being your holding account balance in the ledger.
    const expectedCount = paymentIds.length;

    // Validate we can credit 1130 by the computed total BEFORE inserting.
    const totalRows = await sql(
      `
        SELECT COALESCE(SUM(amount),0) AS total
        FROM payments
        WHERE id = ANY($1::int[])
          AND is_reversed = false
          AND deposited_at IS NULL
      `,
      [paymentIds],
    );
    const total = Number(totalRows?.[0]?.total || 0);

    if (!Number.isFinite(total) || total <= 0) {
      return Response.json({ error: "No eligible payments" }, { status: 400 });
    }

    const guard = await ensureCanCreditAccount({
      creditAccountId: undepositedFundsAccountId,
      amount: total,
    });
    if (!guard.ok) {
      return Response.json(guard.body, { status: guard.status });
    }

    // We do the whole deposit in ONE SQL statement.
    // This keeps it atomic without depending on sql.transaction() semantics.
    const query = `
      WITH selected AS (
        SELECT id, amount, currency
        FROM payments
        WHERE id = ANY($1::int[])
          AND is_reversed = false
          AND deposited_at IS NULL
        FOR UPDATE
      ),
      agg AS (
        SELECT
          COUNT(*)::int AS cnt,
          COALESCE(SUM(amount), 0)::numeric AS total,
          COUNT(DISTINCT COALESCE(currency,'UGX'))::int AS currency_cnt,
          MAX(COALESCE(currency,'UGX')) AS currency
        FROM selected
      ),
      ins AS (
        INSERT INTO transactions (
          transaction_date, description, reference_number,
          debit_account_id, credit_account_id,
          amount, currency,
          created_by,
          source_type,
          approval_status, approved_by, approved_at
        )
        SELECT
          $2::date, $3, NULL,
          $4::int, $5::int,
          agg.total, agg.currency,
          $6::int,
          'deposit',
          $8, $9, $10::timestamptz
        FROM agg
        WHERE agg.cnt = $7::int
          AND agg.total > 0
          AND agg.currency_cnt <= 1
        RETURNING *
      ),
      stamp AS (
        UPDATE transactions t
        SET source_id = t.id
        FROM ins
        WHERE t.id = ins.id
        RETURNING t.id
      ),
      upd_payments AS (
        UPDATE payments p
        SET deposited_at = now(),
            deposited_to_account_id = $4::int,
            deposit_transaction_id = (SELECT id FROM ins)
        FROM selected s
        WHERE p.id = s.id
          AND EXISTS (SELECT 1 FROM ins)
        RETURNING p.id
      ),
      mark_txns AS (
        UPDATE transactions t
        SET deposited_by_transaction_id = (SELECT id FROM ins)
        WHERE t.source_type = 'payment'
          AND t.source_id = ANY($1::int[])
          AND t.debit_account_id = $5::int
          AND COALESCE(t.is_deleted,false) = false
          AND t.deposited_by_transaction_id IS NULL
          AND EXISTS (SELECT 1 FROM ins)
        RETURNING t.id
      )
      SELECT
        (SELECT to_jsonb(ins.*) FROM ins) AS transaction,
        (SELECT total FROM agg) AS amount,
        (SELECT currency FROM agg) AS currency,
        (SELECT cnt FROM agg) AS cnt,
        (SELECT currency_cnt FROM agg) AS currency_cnt,
        (SELECT COALESCE(array_agg(id ORDER BY id), '{}'::int[]) FROM upd_payments) AS deposited_payment_ids,
        (SELECT COUNT(*)::int FROM mark_txns) AS marked_txn_count;
    `;

    const rows = await sql(query, [
      paymentIds,
      depositDate,
      description,
      depositToAccountId,
      undepositedFundsAccountId,
      perm.staff.id,
      expectedCount,
      approval.approval_status,
      approval.approved_by,
      approval.approved_at,
    ]);

    const r = rows?.[0] || null;
    const tx = r?.transaction || null;

    if (!tx) {
      const cnt = Number(r?.cnt || 0);
      const currencyCnt = Number(r?.currency_cnt || 0);

      if (currencyCnt > 1) {
        return Response.json(
          {
            error:
              "Selected payments include multiple currencies. Deposit them separately.",
          },
          { status: 400 },
        );
      }

      if (cnt !== expectedCount) {
        return Response.json(
          {
            error:
              "Some selected payments were already deposited (or reversed). Refresh and try again.",
          },
          { status: 409 },
        );
      }

      return Response.json(
        { error: "Failed to save deposit" },
        { status: 500 },
      );
    }

    const depositedPaymentIds = (r?.deposited_payment_ids || []).map((x) =>
      Number(x),
    );

    // CRITICAL VALIDATION: Verify all payments were marked
    if (depositedPaymentIds.length !== expectedCount) {
      // This should never happen due to CTE atomicity, but check anyway
      console.error(
        `CRITICAL: Deposit ${tx.id} created but only ${depositedPaymentIds.length}/${expectedCount} payments marked!`,
      );
      return Response.json(
        {
          error: `Deposit validation failed: expected to mark ${expectedCount} payments but only marked ${depositedPaymentIds.length}. Please contact support.`,
        },
        { status: 500 },
      );
    }

    console.log(
      `Marked ${Number(r?.marked_txn_count || 0)} legacy payment receipt transactions as deposited`,
    );

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.deposit.create",
      entityType: "transaction",
      entityId: tx?.id || null,
      oldValues: null,
      newValues: {
        ...tx,
        payment_ids: paymentIds,
      },
      ipAddress: perm.ipAddress,
    });

    if (approval.approval_status === "pending") {
      notifyAllAdminsAsync({
        title: "New Deposit Pending Approval",
        message: `New deposit of ${r?.currency || "UGX"} ${Number(r?.amount || 0).toLocaleString()} - ${description} is pending approval. Posted by ${perm.staff.full_name || "Staff"}`,
        type: "transaction",
        reference_id: tx?.id,
        reference_type: "transaction",
      });
    }

    return Response.json({
      transaction: tx,
      deposited_payment_ids: depositedPaymentIds,
      amount: Number(r?.amount || 0),
      currency: r?.currency || "UGX",
    });
  } catch (error) {
    console.error("POST /api/accounting/deposits error", error);

    // Return more specific error messages from validation failures
    const errorMessage =
      error instanceof Error ? error.message : "Failed to save deposit";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
