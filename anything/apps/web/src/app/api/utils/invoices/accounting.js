import sql from "@/app/api/utils/sql";

export async function getAccountingAccountIdByCode(code) {
  const rows = await sql(
    "SELECT id FROM chart_of_accounts WHERE account_code = $1 LIMIT 1",
    [String(code)],
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}
