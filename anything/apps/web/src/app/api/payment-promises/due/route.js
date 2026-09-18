import sql from "@/app/api/utils/sql";
import { requirePermissionOrManager } from "@/app/api/utils/staff";
import { getManagerScope } from "@/app/api/utils/managerScope";

/**
 * Promises Due
 *
 * Latest promise per tenant whose promise_date <= CURRENT_DATE
 * (due today or overdue). Sorted most-overdue first.
 *
 * current_balance reuses the arrears/open-balances definition
 * (see /api/reports/arrears, /api/payments/open-balances,
 * /api/reports/manager-arrears): Σ (amount - paid_amount) across
 * a tenant's unpaid, non-void, non-deleted, approved invoices whose
 * lease is active.
 */
export async function GET(request) {
  const perm = await requirePermissionOrManager(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const scope = await getManagerScope(perm);

    // Portfolio Manager with no assigned properties sees nothing.
    if (scope.scoped && scope.propertyIds.length === 0) {
      return Response.json({ count: 0, promises: [] });
    }

    const params = [];
    let scopeFilter = "";
    if (scope.scoped) {
      params.push(scope.propertyIds);
      scopeFilter = ` AND p.id = ANY($${params.length}::int[])`;
    }

    const rows = await sql(
      `WITH latest AS (
         SELECT DISTINCT ON (pp.tenant_id)
           pp.id,
           pp.tenant_id,
           pp.promise_date,
           pp.amount,
           pp.comment,
           pp.recorded_by,
           pp.created_at,
           pp.updated_at
         FROM payment_promises pp
         ORDER BY pp.tenant_id, pp.created_at DESC, pp.id DESC
       ),
       balances AS (
         SELECT
           i.tenant_id,
           SUM(i.amount - i.paid_amount) AS current_balance,
           MAX((CURRENT_DATE - i.due_date))::int AS max_days_overdue
         FROM invoices i
         WHERE (i.amount - i.paid_amount) > 0
           AND i.status <> 'void'
           AND COALESCE(i.is_deleted, false) = false
           AND COALESCE(i.approval_status, 'approved') = 'approved'
           AND EXISTS (
             SELECT 1 FROM leases l
             WHERE l.id = i.lease_id AND l.status = 'active'
           )
         GROUP BY i.tenant_id
       )
       SELECT
         l.id,
         l.tenant_id,
         l.promise_date,
         l.amount,
         l.comment,
         l.recorded_by,
         t.full_name AS tenant_name,
         t.phone AS tenant_phone,
         p.property_name,
         u.unit_number,
         su.full_name AS recorded_by_name,
         COALESCE(b.current_balance, 0) AS current_balance,
         COALESCE(b.max_days_overdue, 0) AS max_days_overdue
       FROM latest l
       LEFT JOIN tenants t ON t.id = l.tenant_id
       LEFT JOIN LATERAL (
         SELECT al.unit_id
         FROM leases al
         WHERE al.tenant_id = l.tenant_id AND al.status = 'active'
         ORDER BY al.start_date DESC
         LIMIT 1
       ) al ON true
       LEFT JOIN units u ON u.id = al.unit_id
       LEFT JOIN properties p ON p.id = u.property_id
       LEFT JOIN staff_users su ON su.id = l.recorded_by
       LEFT JOIN balances b ON b.tenant_id = l.tenant_id
       WHERE l.promise_date <= CURRENT_DATE${scopeFilter}
       ORDER BY l.promise_date ASC, l.id ASC`,
      params,
    );

    const promises = rows.map((r) => ({
      id: Number(r.id),
      tenant_id: Number(r.tenant_id),
      tenant_name: r.tenant_name || "—",
      tenant_phone: r.tenant_phone || null,
      property_name: r.property_name || null,
      unit_number: r.unit_number || null,
      promise_date: r.promise_date,
      amount:
        r.amount === null || r.amount === undefined ? null : Number(r.amount),
      comment: r.comment,
      recorded_by_name: r.recorded_by_name || null,
      current_balance: Number(r.current_balance || 0),
      max_days_overdue: Number(r.max_days_overdue || 0),
    }));

    return Response.json({ count: promises.length, promises });
  } catch (error) {
    console.error("GET /api/payment-promises/due error", error);
    return Response.json(
      { error: "Failed to fetch due payment promises" },
      { status: 500 },
    );
  }
}
