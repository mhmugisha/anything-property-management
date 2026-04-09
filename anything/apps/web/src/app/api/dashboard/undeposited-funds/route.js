import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "dashboard");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  let step = "start";

  try {
    step = "lookupAccount";
    const accountRows = await sql`
      SELECT id FROM chart_of_accounts WHERE account_code = '1130' LIMIT 1
    `;

    const undepositedFundsId = accountRows?.[0]?.id
      ? Number(accountRows[0].id)
      : null;

    if (!undepositedFundsId) {
      return Response.json({ lines: [] });
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
      console.error("dashboard undeposited-funds backfill failed", e);
    }

    step = "queryLines";
    const rows = await sql`
      SELECT
        t.id,
        t.transaction_date,
        t.description,
        t.amount
      FROM transactions t
      LEFT JOIN payments pm ON pm.id = t.source_id AND t.source_type = 'payment'
      WHERE t.debit_account_id = ${undepositedFundsId}
        AND COALESCE(t.is_deleted,false) = false
        AND t.deposited_by_transaction_id IS NULL
        AND (
          t.source_type <> 'payment'
          OR pm.deposited_at IS NULL
        )
      ORDER BY t.transaction_date DESC, t.id DESC
      LIMIT 200
    `;

    const lines = (rows || []).map((r) => {
      return {
        id: Number(r.id),
        transaction_date: r.transaction_date,
        name: r.description,
        amount: Number(r.amount || 0),
      };
    });

    step = "done";
    return Response.json({ lines });
  } catch (error) {
    console.error(
      "Error fetching dashboard undeposited funds lines (step=" + step + "):",
      error,
    );
    return Response.json(
      { error: `Failed to fetch undeposited funds lines (step: ${step})` },
      { status: 500 },
    );
  }
}
