import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    // We list undeposited items from the LEDGER (transactions), not from payments.
    // Definition: debit transactions posted to Undeposited Funds (1130) that have not yet been swept
    // into a deposit (i.e. deposited_by_transaction_id IS NULL).

    const accountRows = await sql`
      SELECT id FROM chart_of_accounts WHERE account_code = '1130' LIMIT 1
    `;

    const undepositedFundsId = accountRows?.[0]?.id
      ? Number(accountRows[0].id)
      : null;

    if (!undepositedFundsId) {
      return Response.json(
        { error: "Undeposited Funds (1130) account not found" },
        { status: 500 },
      );
    }

    // Best-effort backfill: if a payment was deposited via the legacy flow,
    // mark its corresponding 1130 debit receipt transaction as deposited.
    try {
      await sql(
        `
        UPDATE transactions t
        SET deposited_by_transaction_id = p.deposit_transaction_id
        FROM payments p
        WHERE t.source_type = 'payment'
          AND t.source_id = p.id
          AND p.deposit_transaction_id IS NOT NULL
          AND t.deposited_by_transaction_id IS NULL
          AND COALESCE(t.is_deleted,false) = false
          AND t.debit_account_id = $1::int
        `,
        [undepositedFundsId],
      );
    } catch (e) {
      console.error(
        "undeposited-funds: backfill deposited_by_transaction_id failed",
        e,
      );
    }

    // Only return truly undeposited items.
    // Important: For payment receipts, also exclude those where payments.deposited_at is already set.
    const rows = await sql`
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
      WHERE t.debit_account_id = ${undepositedFundsId}
        AND COALESCE(t.is_deleted, false) = false
        AND t.deposited_by_transaction_id IS NULL
        AND (
          t.source_type NOT IN ('payment', 'payment_advance')
          OR pm.deposited_at IS NULL
        )
      ORDER BY t.transaction_date ASC, t.id ASC
      LIMIT 500
    `;

    const payments = (rows || []).map((r) => {
      const method = r.payment_method || "Journal Entry";
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

    return Response.json({ payments });
  } catch (error) {
    console.error("GET /api/accounting/undeposited-funds error", error);
    return Response.json(
      { error: "Failed to fetch undeposited funds" },
      { status: 500 },
    );
  }
}
