import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function nextMonthStart() {
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

    const tenantRows =
      await sql`SELECT * FROM tenants WHERE id = ${tenantId} LIMIT 1`;
    const tenant = tenantRows?.[0] || null;
    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    const updatedRows = await sql`
      UPDATE tenants
      SET status = 'active'
      WHERE id = ${tenantId}
      RETURNING id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
    `;

    const updatedTenant = updatedRows?.[0] || null;

    // If the tenant has no active lease, automatically open a new lease starting next month
    // (so billing starts next cycle, not retroactively).
    const activeLeaseRows = await sql`
      SELECT id
      FROM leases
      WHERE tenant_id = ${tenantId}
        AND status = 'active'
      LIMIT 1
    `;

    let lease = null;

    if ((activeLeaseRows || []).length === 0) {
      const lastLeaseRows = await sql`
        SELECT *
        FROM leases
        WHERE tenant_id = ${tenantId}
        ORDER BY start_date DESC
        LIMIT 1
      `;

      const lastLease = lastLeaseRows?.[0] || null;

      if (lastLease?.unit_id) {
        const startDate = nextMonthStart();
        const startDateStr = ymd(startDate);

        const defaultEnd = new Date(startDate);
        defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
        defaultEnd.setDate(defaultEnd.getDate() - 1);
        const endDateStr = ymd(defaultEnd);

        const overlapping = await sql`
          SELECT id
          FROM leases
          WHERE unit_id = ${Number(lastLease.unit_id)}
            AND status = 'active'
            AND start_date <= ${endDateStr}::date
            AND end_date >= ${startDateStr}::date
          LIMIT 1
        `;

        if ((overlapping || []).length === 0) {
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

          lease = inserted?.[0] || null;

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
        }
      }
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "tenant.activate",
      entityType: "tenant",
      entityId: tenantId,
      oldValues: tenant,
      newValues: updatedTenant,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ tenant: updatedTenant, lease });
  } catch (error) {
    console.error("POST /api/tenants/[id]/reactivate error", error);
    return Response.json(
      { error: "Failed to reactivate tenant" },
      { status: 500 },
    );
  }
}
