import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import {
  getAccountBalancesByIds,
  getAccountIdByCode,
} from "@/app/api/utils/accounting";

// Worklist render cap only. Totals below are computed over ALL depositable rows.
const LIST_LIMIT = 500;

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    // We list undeposited items from the LEDGER (transactions), not from payments.
    // Definition: debit transactions posted to Undeposited Funds (1130) that have not yet been swept
    // into a deposit (i.e. deposited_by_transaction_id IS NULL).
    //
    // This GET is read-only. The deposit POST stamps deposited_by_transaction_id
    // (and payments.deposit_transaction_id) atomically in both its flows.

    const [undepositedFundsId, holdingId] = await Promise.all([
      getAccountIdByCode("1130"),
      getAccountIdByCode("2500"),
    ]);

    if (!undepositedFundsId) {
      return Response.json(
        { error: "Undeposited Funds (1130) account not found" },
        { status: 500 },
      );
    }

    // Depositable predicate. Receipts from payments/security deposits, plus
    // genuine received-to-Holding cash (manual Dr 1130 / Cr 2500). Never
    // matches manual_adjustment or deposit_reversal rows.
    // For payment receipts, also exclude those where payments.deposited_at is already set.
    const depositableWhere = `
      t.debit_account_id = $1::int
      AND COALESCE(t.is_deleted, false) = false
      AND COALESCE(t.approval_status, 'approved') = 'approved'
      AND t.deposited_by_transaction_id IS NULL
      AND (
        (
          t.source_type IN ('payment', 'payment_advance', 'security_deposit', 'security_deposit_adjustment')
          AND (
            t.source_type NOT IN ('payment', 'payment_advance')
            OR pm.deposited_at IS NULL
          )
        )
        OR (
          t.source_type = 'manual'
          AND $2::int IS NOT NULL
          AND t.credit_account_id = $2::int
        )
      )
    `;
    const params = [undepositedFundsId, holdingId];

    const [rows, totalsRows, balances] = await Promise.all([
      sql(
        `
        SELECT
          t.id,
          t.transaction_date,
          t.description,
          t.amount,
          COALESCE(t.currency, 'UGX') AS currency,
          t.source_type,
          t.source_id,
          t.reference_number,
          pm.payment_method,
          pm.deposited_at AS payment_deposited_at,
          tn.full_name AS tenant_name,
          pr.property_name,
          su.full_name AS created_by_name
        FROM transactions t
        LEFT JOIN payments pm ON pm.id = t.source_id AND t.source_type IN ('payment', 'payment_advance')
        LEFT JOIN tenants tn ON tn.id = pm.tenant_id
        LEFT JOIN properties pr ON pr.id = pm.property_id
        LEFT JOIN staff_users su ON su.id = t.created_by
        WHERE ${depositableWhere}
        ORDER BY t.transaction_date ASC, t.id ASC
        LIMIT ${LIST_LIMIT}
        `,
        params,
      ),
      sql(
        `
        SELECT
          COALESCE(SUM(t.amount), 0)::numeric AS total,
          COUNT(*)::int AS cnt
        FROM transactions t
        LEFT JOIN payments pm ON pm.id = t.source_id AND t.source_type IN ('payment', 'payment_advance')
        WHERE ${depositableWhere}
        `,
        params,
      ),
      getAccountBalancesByIds([undepositedFundsId]),
    ]);

    const payments = (rows || []).map((r) => {
      const method =
        r.payment_method ||
        (r.source_type === "manual" ? "Received to Holding" : "Journal Entry");
      return {
        id: Number(r.id), // transaction id
        payment_date: r.transaction_date,
        amount: Number(r.amount || 0),
        currency: r.currency || "UGX",
        payment_method: method,
        notes: r.reference_number,
        tenant_name: r.tenant_name,
        property_name: r.property_name,
        invoice_description: null,
        description: r.description,
        source_type: r.source_type,
        created_by_name: r.created_by_name,
      };
    });

    return Response.json({
      payments,
      depositableTotal: Number(totalsRows?.[0]?.total || 0),
      depositableCount: Number(totalsRows?.[0]?.cnt || 0),
      glBalance1130: Number(balances[String(undepositedFundsId)] || 0),
      listLimit: LIST_LIMIT,
    });
  } catch (error) {
    console.error("GET /api/accounting/undeposited-funds error", error);
    return Response.json(
      { error: "Failed to fetch undeposited funds" },
      { status: 500 },
    );
  }
}
