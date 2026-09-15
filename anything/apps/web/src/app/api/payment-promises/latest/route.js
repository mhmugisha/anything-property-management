import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get("tenant_ids") || "").trim();

    if (!raw) {
      return Response.json({ latest_by_tenant: {} });
    }

    const tenantIds = Array.from(
      new Set(
        raw
          .split(",")
          .map((s) => Number(String(s).trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    if (tenantIds.length === 0) {
      return Response.json({ latest_by_tenant: {} });
    }

    const rows = await sql(
      `SELECT DISTINCT ON (pp.tenant_id)
         pp.id, pp.tenant_id, pp.promise_date, pp.amount, pp.comment,
         pp.recorded_by, pp.created_at, pp.updated_at,
         su.full_name AS recorded_by_name
       FROM payment_promises pp
       LEFT JOIN staff_users su ON su.id = pp.recorded_by
       WHERE pp.tenant_id = ANY($1::int[])
       ORDER BY pp.tenant_id, pp.created_at DESC, pp.id DESC`,
      [tenantIds],
    );

    const latestByTenant = {};
    for (const r of rows) {
      latestByTenant[Number(r.tenant_id)] = {
        id: Number(r.id),
        promise_date: r.promise_date,
        amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
        comment: r.comment,
        recorded_by:
          r.recorded_by === null || r.recorded_by === undefined
            ? null
            : Number(r.recorded_by),
        recorded_by_name: r.recorded_by_name || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    }

    return Response.json({ latest_by_tenant: latestByTenant });
  } catch (error) {
    console.error("GET /api/payment-promises/latest error", error);
    return Response.json(
      { error: "Failed to fetch latest payment promises" },
      { status: 500 },
    );
  }
}
