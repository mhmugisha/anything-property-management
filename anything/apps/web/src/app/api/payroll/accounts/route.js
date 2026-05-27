import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

// Returns the asset accounts needed for payroll payment dropdowns (1110, 1120)
export async function GET(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const rows = await sql`
      SELECT id, account_code, account_name
      FROM chart_of_accounts
      WHERE account_type = 'Asset'
        AND account_code IN ('1110', '1120')
        AND COALESCE(is_active, true) = true
      ORDER BY account_code ASC
    `;

    return Response.json({
      accounts: (rows || []).map((r) => ({
        id: Number(r.id),
        account_code: r.account_code,
        account_name: r.account_name,
      })),
    });
  } catch (error) {
    console.error("GET /api/payroll/accounts error", error);
    return Response.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}
