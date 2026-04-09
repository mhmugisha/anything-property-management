import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    // We intentionally include any Asset accounts that look like Bank/Cash accounts.
    // Exclude Undeposited Funds (1130) so users can't "deposit" into the same holding account.
    const rows = await sql`
      SELECT id, account_code, account_name, account_type
      FROM chart_of_accounts
      WHERE COALESCE(is_active, true) = true
        AND account_type = 'Asset'
        AND account_code <> '1130'
        AND (
          account_code LIKE '11%'
          OR LOWER(account_name) LIKE '%bank%'
          OR LOWER(account_name) LIKE '%cash%'
        )
      ORDER BY account_code
    `;

    const accounts = (rows || []).map((a) => ({
      id: Number(a.id),
      account_code: a.account_code,
      account_name: a.account_name,
      account_type: a.account_type,
      label: `${a.account_code} • ${a.account_name}`,
    }));

    return Response.json({ accounts });
  } catch (error) {
    console.error("GET /api/accounting/deposit-accounts error", error);
    return Response.json(
      { error: "Failed to fetch deposit accounts" },
      { status: 500 },
    );
  }
}
