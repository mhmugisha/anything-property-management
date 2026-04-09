import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const accountId = Number(id);
    if (!accountId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const accountRows = await sql`
      SELECT id, account_code, account_name, account_type
      FROM chart_of_accounts
      WHERE id = ${accountId}
      LIMIT 1
    `;

    const account = accountRows?.[0] || null;
    if (!account) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    // First, fetch ALL transactions to calculate true running balances
    const allTxsQuery = `
      SELECT
        t.id,
        t.transaction_date,
        t.debit_account_id,
        t.credit_account_id,
        t.amount
      FROM transactions t
      WHERE (t.debit_account_id = $1 OR t.credit_account_id = $1)
        AND COALESCE(t.is_deleted, false) = false
      ORDER BY t.transaction_date ASC, t.id ASC
    `;

    const allTxs = await sql(allTxsQuery, [accountId]);

    const normalDebitTypes = new Set(["Asset", "Expense"]);
    const isNormalDebit = normalDebitTypes.has(account.account_type);

    // Calculate running balance for ALL transactions and store in a map
    let running = 0;
    const balanceMap = new Map();

    for (const t of allTxs) {
      const debit =
        t.debit_account_id === accountId ? Number(t.amount || 0) : 0;
      const credit =
        t.credit_account_id === accountId ? Number(t.amount || 0) : 0;
      const delta = isNormalDebit ? debit - credit : credit - debit;
      running += delta;
      balanceMap.set(t.id, running);
    }

    // Now fetch FILTERED transactions (using original SQL WHERE logic)
    const where = [
      `(t.debit_account_id = $1 OR t.credit_account_id = $1)`,
      `COALESCE(t.is_deleted,false) = false`,
    ];
    const values = [accountId];

    if (from) {
      where.push(`t.transaction_date >= $${values.length + 1}::date`);
      values.push(from);
    }

    if (to) {
      where.push(`t.transaction_date <= $${values.length + 1}::date`);
      values.push(to);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const query = `
      SELECT
        t.id,
        t.transaction_date,
        t.description,
        t.reference_number,
        t.debit_account_id,
        t.credit_account_id,
        t.amount,
        t.source_type,
        t.source_id,
        su.full_name AS created_by_name
      FROM transactions t
      LEFT JOIN staff_users su ON t.created_by = su.id
      ${whereSql}
      ORDER BY t.transaction_date ASC, t.id ASC
      LIMIT 10000
    `;

    const txs = await sql(query, values);

    // Map filtered transactions to rows with running balance from the balance map
    const rows = txs.map((t) => {
      const debit =
        t.debit_account_id === accountId ? Number(t.amount || 0) : 0;
      const credit =
        t.credit_account_id === accountId ? Number(t.amount || 0) : 0;

      return {
        id: t.id,
        transaction_date: t.transaction_date,
        description: t.description,
        reference_number: t.reference_number,
        debit,
        credit,
        balance: balanceMap.get(t.id) || 0,
        created_by_name: t.created_by_name,
        source_type: t.source_type,
        source_id: t.source_id,
      };
    });

    // Calculate all-time totals from ALL transactions (not just filtered)
    const allTimeDebitTotal = allTxs.reduce((sum, t) => {
      const debit =
        t.debit_account_id === accountId ? Number(t.amount || 0) : 0;
      return sum + debit;
    }, 0);

    const allTimeCreditTotal = allTxs.reduce((sum, t) => {
      const credit =
        t.credit_account_id === accountId ? Number(t.amount || 0) : 0;
      return sum + credit;
    }, 0);

    // Get the true current account balance (from ALL transactions, not just filtered ones)
    // This is the final running balance from the very last transaction in the account's history
    const finalBalance =
      allTxs.length > 0 ? balanceMap.get(allTxs[allTxs.length - 1].id) || 0 : 0;

    return Response.json({
      account,
      rows,
      finalBalance,
      allTimeDebitTotal,
      allTimeCreditTotal,
    });
  } catch (error) {
    console.error("GET /api/accounting/accounts/[id]/statement error", error);
    return Response.json(
      { error: "Failed to build account statement" },
      { status: 500 },
    );
  }
}
