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

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
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
      ${whereSql}
      GROUP BY a.id
      ORDER BY a.account_code
    `;

    const rows = await sql(query, values);

    const mapped = rows.map((r) => {
      const debitTotal = Number(r.debit_total);
      const creditTotal = Number(r.credit_total);
      const net = debitTotal - creditTotal; // positive = debit balance, negative = credit balance

      const debit_balance = net > 0 ? net : 0;
      const credit_balance = net < 0 ? Math.abs(net) : 0;

      return {
        id: r.id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,

        // Keep gross totals for transparency/debugging
        debit_total: debitTotal,
        credit_total: creditTotal,

        // What the UI should show: one balance per account line
        debit_balance,
        credit_balance,
        net,
      };
    });

    const totals = mapped.reduce(
      (acc, r) => {
        acc.debit_total += r.debit_total;
        acc.credit_total += r.credit_total;
        acc.debit_balance += r.debit_balance;
        acc.credit_balance += r.credit_balance;
        return acc;
      },
      { debit_total: 0, credit_total: 0, debit_balance: 0, credit_balance: 0 },
    );

    return Response.json({ rows: mapped, totals });
  } catch (error) {
    console.error("GET /api/accounting/trial-balance error", error);
    return Response.json(
      { error: "Failed to build trial balance" },
      { status: 500 },
    );
  }
}
