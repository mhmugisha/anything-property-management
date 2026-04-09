import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const where = ["COALESCE(t.is_deleted,false) = false"];
    const values = [];

    if (from) {
      where.push(`t.transaction_date >= $${values.length + 1}::date`);
      values.push(from);
    }
    if (to) {
      where.push(`t.transaction_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const whereSql = where.length ? `AND ${where.join(" AND ")}` : "";

    // Income totals per account
    const incomeQuery = `
      SELECT
        a.id AS account_id,
        a.account_code,
        a.account_name,
        COALESCE(SUM(t.amount), 0) AS amount
      FROM transactions t
      JOIN chart_of_accounts a ON a.id = t.credit_account_id
      WHERE a.account_type = 'Income'
      ${whereSql}
      GROUP BY a.id, a.account_code, a.account_name
      ORDER BY a.account_code
    `;

    // Expense totals per account
    const expenseQuery = `
      SELECT
        a.id AS account_id,
        a.account_code,
        a.account_name,
        COALESCE(SUM(t.amount), 0) AS amount
      FROM transactions t
      JOIN chart_of_accounts a ON a.id = t.debit_account_id
      WHERE a.account_type = 'Expense'
      ${whereSql}
      GROUP BY a.id, a.account_code, a.account_name
      ORDER BY a.account_code
    `;

    const incomeRows = await sql(incomeQuery, values);
    const expenseRows = await sql(expenseQuery, values);

    const income = incomeRows.map((r) => ({
      id: String(r.account_id),
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      amount: Number(r.amount || 0),
    }));

    const expenses = expenseRows.map((r) => ({
      id: String(r.account_id),
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      amount: Number(r.amount || 0),
    }));

    const totalIncome = income.reduce((sum, a) => sum + a.amount, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    return Response.json({
      income,
      expenses,
      totals: { totalIncome, totalExpenses, netProfit },
    });
  } catch (error) {
    console.error("GET /api/accounting/pl error", error);
    return Response.json({ error: "Failed to build P&L" }, { status: 500 });
  }
}
