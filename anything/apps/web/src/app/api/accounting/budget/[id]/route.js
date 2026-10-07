import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function DELETE(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const lineId = toNumber(id);
    if (!lineId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id, account_id, period_month, amount
      FROM operating_budget_lines
      WHERE id = ${lineId}
      LIMIT 1
    `;
    if (!existing?.[0]) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await sql`DELETE FROM operating_budget_lines WHERE id = ${lineId}`;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.budget.delete",
      entityType: "operating_budget_lines",
      entityId: lineId,
      oldValues: existing[0],
      newValues: null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/accounting/budget/[id] error", error);
    return Response.json(
      { error: "Failed to delete budget line" },
      { status: 500 },
    );
  }
}
