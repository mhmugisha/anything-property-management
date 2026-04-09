import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function nextMonthStart() {
  // First day of next month (billing starts next cycle)
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

export async function POST(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const tenantId = Number(id);
    if (!tenantId) {
      return Response.json({ error: "Invalid tenant id" }, { status: 400 });
    }

    const tenantRows = await sql`
      SELECT *
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    const tenant = tenantRows?.[0] || null;
    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.status === "archived") {
      return Response.json(
        { error: "Tenant is archived. Activate the tenant first." },
        { status: 400 },
      );
    }

    const activeLeaseRows = await sql`
      SELECT id
      FROM leases
      WHERE tenant_id = ${tenantId}
        AND status = 'active'
      LIMIT 1
    `;

    if ((activeLeaseRows || []).length > 0) {
      return Response.json(
        { error: "This tenant already has an active lease" },
        { status: 400 },
      );
    }

    // Use the most recent lease as a template.
    const lastLeaseRows = await sql`
      SELECT *
      FROM leases
      WHERE tenant_id = ${tenantId}
      ORDER BY start_date DESC
      LIMIT 1
    `;

    const lastLease = lastLeaseRows?.[0] || null;
    if (!lastLease?.unit_id) {
      return Response.json(
        { error: "No previous lease found to reopen. Create a new lease." },
        { status: 400 },
      );
    }

    const startDate = nextMonthStart();
    const startDateStr = ymd(startDate);

    // Default: 1 year lease from next month.
    const defaultEnd = new Date(startDate);
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
    defaultEnd.setDate(defaultEnd.getDate() - 1);

    const endDateStr = ymd(defaultEnd);

    // Ensure unit is still vacant (or at least has no active lease overlapping this range).
    const overlapping = await sql`
      SELECT id
      FROM leases
      WHERE unit_id = ${Number(lastLease.unit_id)}
        AND status = 'active'
        AND start_date <= ${endDateStr}::date
        AND end_date >= ${startDateStr}::date
      LIMIT 1
    `;

    if ((overlapping || []).length > 0) {
      return Response.json(
        {
          error:
            "Cannot open lease: the previous unit is not available anymore. Please create a new lease and select another unit.",
        },
        { status: 409 },
      );
    }

    const inserted = await sql`
      INSERT INTO leases (
        unit_id, tenant_id, start_date, end_date, monthly_rent, currency,
        deposit_amount, deposit_paid, billing_day, auto_renew, status, created_by
      )
      VALUES (
        ${Number(lastLease.unit_id)},
        ${tenantId},
        ${startDateStr}::date,
        ${endDateStr}::date,
        ${lastLease.monthly_rent},
        ${lastLease.currency || "UGX"},
        ${lastLease.deposit_amount},
        0,
        ${Number(lastLease.billing_day || 1)},
        false,
        'active',
        ${perm.staff.id}
      )
      RETURNING *
    `;

    const lease = inserted?.[0] || null;

    // Update unit status
    await sql`UPDATE units SET status = 'occupied' WHERE id = ${Number(lastLease.unit_id)}`;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "lease.open",
      entityType: "lease",
      entityId: lease?.id || null,
      oldValues: null,
      newValues: lease,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ lease });
  } catch (error) {
    console.error("POST /api/tenants/[id]/open-lease error", error);
    return Response.json(
      { error: "Failed to open lease" },
      {
        status: 500,
      },
    );
  }
}
