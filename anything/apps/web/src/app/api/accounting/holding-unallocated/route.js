import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const accountRows = await sql`
      SELECT id FROM chart_of_accounts WHERE account_code = '2500' LIMIT 1
    `;
    const holdingAccountId = accountRows?.[0]?.id
      ? Number(accountRows[0].id)
      : null;

    if (!holdingAccountId) {
      return Response.json(
        { error: "Holding (2500) account not found" },
        { status: 500 },
      );
    }

    const rows = await sql`
      SELECT
        t.id,
        t.transaction_date,
        t.description,
        t.reference_number,
        t.amount,
        COALESCE(t.currency, 'UGX') AS currency,
        su.full_name AS created_by_name
      FROM transactions t
      LEFT JOIN staff_users su ON su.id = t.created_by
      WHERE t.credit_account_id = ${holdingAccountId}
        AND COALESCE(t.is_deleted, false) = false
        AND COALESCE(t.approval_status, 'approved') = 'approved'
        AND t.allocated_by_transaction_id IS NULL
      ORDER BY t.transaction_date ASC, t.id ASC
      LIMIT 500
    `;

    return Response.json({ entries: rows || [] });
  } catch (error) {
    console.error("GET /api/accounting/holding-unallocated error", error);
    return Response.json(
      { error: "Failed to fetch holding entries" },
      { status: 500 },
    );
  }
}
