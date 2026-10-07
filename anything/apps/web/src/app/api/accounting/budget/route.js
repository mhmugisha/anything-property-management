import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getExpenseCommitted } from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseMonth(input) {
  const s = String(input || "").trim();
  if (!/^\d{4}-\d{2}-01$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const month = parseMonth(searchParams.get("month"));

    if (!month) {
      return Response.json(
        { error: "month must be YYYY-MM-01 (first of month)" },
        { status: 400 },
      );
    }

    const lineRows = await sql`
      SELECT b.id,
             b.account_id,
             a.account_code,
             a.account_name,
             b.amount AS budget_amount
      FROM operating_budget_lines b
      JOIN chart_of_accounts a ON a.id = b.account_id
      WHERE b.period_month = ${month}::date
      ORDER BY a.account_code
    `;

    const lines = [];
    for (const row of lineRows) {
      const spent = await getExpenseCommitted(row.account_id, month);
      const budgetAmount = Number(row.budget_amount || 0);
      lines.push({
        id: row.id,
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name,
        budget_amount: budgetAmount,
        spent,
        remaining: budgetAmount - spent,
      });
    }

    const usedIds = lines.map((l) => l.account_id);
    const availableRows = usedIds.length
      ? await sql`
          SELECT id, account_code, account_name
          FROM chart_of_accounts
          WHERE account_type = 'Expense'
            AND COALESCE(is_active, true) = true
            AND id <> ALL(${usedIds}::int[])
          ORDER BY account_code
        `
      : await sql`
          SELECT id, account_code, account_name
          FROM chart_of_accounts
          WHERE account_type = 'Expense'
            AND COALESCE(is_active, true) = true
          ORDER BY account_code
        `;

    return Response.json({
      month,
      lines,
      available_accounts: availableRows,
    });
  } catch (error) {
    console.error("GET /api/accounting/budget error", error);
    return Response.json(
      { error: "Failed to fetch budget" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();
    const month = parseMonth(body?.period_month);
    const inputLines = Array.isArray(body?.lines) ? body.lines : null;

    if (!month) {
      return Response.json(
        { error: "period_month must be YYYY-MM-01 (first of month)" },
        { status: 400 },
      );
    }

    if (!inputLines) {
      return Response.json(
        { error: "lines must be an array of { account_id, amount }" },
        { status: 400 },
      );
    }

    const seen = new Set();
    const cleaned = [];
    for (const raw of inputLines) {
      const accountId = toNumber(raw?.account_id);
      const amount = toNumber(raw?.amount);
      if (!accountId) {
        return Response.json(
          { error: "Each line requires a numeric account_id" },
          { status: 400 },
        );
      }
      if (amount === null || amount < 0 || !Number.isInteger(amount)) {
        return Response.json(
          { error: "Each amount must be a non-negative integer" },
          { status: 400 },
        );
      }
      if (seen.has(accountId)) {
        return Response.json(
          { error: `Duplicate account_id ${accountId} in request` },
          { status: 400 },
        );
      }
      seen.add(accountId);
      cleaned.push({ accountId, amount });
    }

    if (cleaned.length === 0) {
      return Response.json({ ok: true, upserted: 0 });
    }

    const ids = cleaned.map((l) => l.accountId);
    const expenseRows = await sql`
      SELECT id
      FROM chart_of_accounts
      WHERE id = ANY(${ids}::int[])
        AND account_type = 'Expense'
    `;
    const expenseIds = new Set(expenseRows.map((r) => Number(r.id)));
    for (const l of cleaned) {
      if (!expenseIds.has(l.accountId)) {
        return Response.json(
          {
            error: `Account ${l.accountId} is not an Expense account`,
          },
          { status: 400 },
        );
      }
    }

    const upserted = [];
    for (const l of cleaned) {
      const rows = await sql`
        INSERT INTO operating_budget_lines
          (account_id, period_month, amount, created_by, updated_by)
        VALUES
          (${l.accountId}, ${month}::date, ${l.amount}, ${perm.staff.id}, ${perm.staff.id})
        ON CONFLICT (account_id, period_month)
        DO UPDATE SET
          amount = EXCLUDED.amount,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
        RETURNING id, account_id, period_month, amount
      `;
      if (rows?.[0]) upserted.push(rows[0]);
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.budget.upsert",
      entityType: "operating_budget_lines",
      entityId: null,
      oldValues: null,
      newValues: { period_month: month, lines: upserted },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true, upserted: upserted.length, lines: upserted });
  } catch (error) {
    console.error("PUT /api/accounting/budget error", error);
    return Response.json(
      { error: "Failed to save budget" },
      { status: 500 },
    );
  }
}
