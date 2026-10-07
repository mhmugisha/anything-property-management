import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function parseMonth(input) {
  const s = String(input || "").trim();
  if (!/^\d{4}-\d{2}-01$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();
    const toMonth = parseMonth(body?.to_month);

    if (!toMonth) {
      return Response.json(
        { error: "to_month must be YYYY-MM-01 (first of month)" },
        { status: 400 },
      );
    }

    const existing = await sql`
      SELECT 1 FROM operating_budget_lines WHERE period_month = ${toMonth}::date LIMIT 1
    `;
    if (existing?.length) {
      return Response.json(
        { error: "Target month already has budget lines; copy is a no-op" },
        { status: 409 },
      );
    }

    const sourceRows = await sql`
      SELECT period_month
      FROM operating_budget_lines
      WHERE period_month < ${toMonth}::date
      GROUP BY period_month
      ORDER BY period_month DESC
      LIMIT 1
    `;
    const sourceMonth = sourceRows?.[0]?.period_month || null;
    if (!sourceMonth) {
      return Response.json(
        { error: "No earlier budget to copy from" },
        { status: 409 },
      );
    }

    const inserted = await sql`
      INSERT INTO operating_budget_lines
        (account_id, period_month, amount, created_by, updated_by)
      SELECT account_id, ${toMonth}::date, amount, ${perm.staff.id}, ${perm.staff.id}
      FROM operating_budget_lines
      WHERE period_month = ${sourceMonth}
      RETURNING id, account_id, amount
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.budget.copy",
      entityType: "operating_budget_lines",
      entityId: null,
      oldValues: { source_month: sourceMonth },
      newValues: { to_month: toMonth, copied: inserted.length },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      source_month: sourceMonth,
      to_month: toMonth,
      copied: inserted.length,
    });
  } catch (error) {
    console.error("POST /api/accounting/budget/copy error", error);
    return Response.json(
      { error: "Failed to copy budget" },
      { status: 500 },
    );
  }
}
