import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const to = (searchParams.get("to") || "").trim();
    const from = (searchParams.get("from") || "").trim();

    const where = [];
    const values = [];

    if (to) {
      where.push(`t.transaction_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const typeFilter = "a.account_type IN ('Asset', 'Liability', 'Equity')";

    const finalWhere = [];
    finalWhere.push(typeFilter);
    finalWhere.push("COALESCE(t.is_deleted,false) = false");
    finalWhere.push("COALESCE(t.approval_status, 'approved') = 'approved'");
    if (where.length > 0) {
      finalWhere.push(...where);
    }

    const finalQuery = `
      SELECT
        a.id,
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(SUM(CASE WHEN t.debit_account_id = a.id THEN t.amount ELSE 0 END), 0) AS debit_total,
        COALESCE(SUM(CASE WHEN t.credit_account_id = a.id THEN t.amount ELSE 0 END), 0) AS credit_total
      FROM chart_of_accounts a
      LEFT JOIN transactions t
        ON (t.debit_account_id = a.id OR t.credit_account_id = a.id)
      ${finalWhere.length ? `WHERE ${finalWhere.join(" AND ")}` : ""}
      GROUP BY a.id
      ORDER BY a.account_code
    `;

    const rows = await sql(finalQuery, values);

    const assets = [];
    const liabilities = [];
    const equity = [];

    for (const r of rows) {
      const debit = Number(r.debit_total);
      const credit = Number(r.credit_total);

      if (r.account_type === "Asset") {
        assets.push({
          id: r.id,
          account_code: r.account_code,
          account_name: r.account_name,
          amount: debit - credit,
        });
      }

      if (r.account_type === "Liability") {
        liabilities.push({
          id: r.id,
          account_code: r.account_code,
          account_name: r.account_name,
          amount: credit - debit,
        });
      }

      if (r.account_type === "Equity") {
        equity.push({
          id: r.id,
          account_code: r.account_code,
          account_name: r.account_name,
          amount: credit - debit,
        });
      }
    }

    // Calculate Retained Earnings from P&L
    const plWhere = ["COALESCE(t.is_deleted,false) = false", "COALESCE(t.approval_status, 'approved') = 'approved'"];
    const plValues = [];

    if (from) {
      plWhere.push(`t.transaction_date >= $${plValues.length + 1}::date`);
      plValues.push(from);
    }
    if (to) {
      plWhere.push(`t.transaction_date <= $${plValues.length + 1}::date`);
      plValues.push(to);
    }

    const plWhereSql = plWhere.length ? `AND ${plWhere.join(" AND ")}` : "";

    // Calculate total income
    const incomeQuery = `
      SELECT COALESCE(SUM(t.amount), 0) AS total_income
      FROM transactions t
      JOIN chart_of_accounts a ON a.id = t.credit_account_id
      WHERE a.account_type = 'Income'
      ${plWhereSql}
    `;

    // Calculate total expenses
    const expenseQuery = `
      SELECT COALESCE(SUM(t.amount), 0) AS total_expenses
      FROM transactions t
      JOIN chart_of_accounts a ON a.id = t.debit_account_id
      WHERE a.account_type = 'Expense'
      ${plWhereSql}
    `;

    const incomeResult = await sql(incomeQuery, plValues);
    const expenseResult = await sql(expenseQuery, plValues);

    const totalIncome = Number(incomeResult?.[0]?.total_income || 0);
    const totalExpenses = Number(expenseResult?.[0]?.total_expenses || 0);
    const retainedEarnings = totalIncome - totalExpenses;

    // Add Retained Earnings as a calculated equity item
    equity.push({
      id: "retained_earnings",
      account_code: "",
      account_name: "Retained Earnings",
      amount: retainedEarnings,
    });

    const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.amount, 0);
    const equityAccountsTotal = equity.reduce((sum, a) => sum + a.amount, 0);

    // Total Equity = Equity Accounts + Retained Earnings (already included in equityAccountsTotal)
    const totalEquity = equityAccountsTotal;

    return Response.json({
      assets,
      liabilities,
      equity,
      totals: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        retainedEarnings,
        liabilitiesPlusEquity: totalLiabilities + totalEquity,
      },
    });
  } catch (error) {
    console.error("GET /api/accounting/balance-sheet error", error);
    return Response.json(
      { error: "Failed to build balance sheet" },
      { status: 500 },
    );
  }
}
