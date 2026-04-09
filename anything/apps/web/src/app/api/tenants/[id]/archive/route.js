import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

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

    // End any active lease first (same rules as the explicit End Lease action)
    const leaseRows = await sql`
      SELECT *
      FROM leases
      WHERE tenant_id = ${tenantId}
        AND status = 'active'
      ORDER BY start_date DESC
      LIMIT 1
    `;

    const lease = leaseRows?.[0] || null;

    if (lease) {
      await sql`
        UPDATE leases
        SET status = 'ended',
            auto_renew = false,
            end_date = CASE
              WHEN end_date > CURRENT_DATE THEN CURRENT_DATE
              ELSE end_date
            END
        WHERE id = ${lease.id}
      `;

      if (lease.unit_id) {
        await sql`UPDATE units SET status = 'vacant' WHERE id = ${lease.unit_id}`;
      }

      await sql`
        UPDATE invoices
        SET status = 'void'
        WHERE lease_id = ${lease.id}
          AND invoice_date > CURRENT_DATE
          AND paid_amount = 0
          AND status <> 'paid'
      `;

      await writeAuditLog({
        staffId: perm.staff.id,
        action: "lease.end",
        entityType: "lease",
        entityId: lease.id,
        oldValues: lease,
        newValues: { ...lease, status: "ended" },
        ipAddress: perm.ipAddress,
      });
    }

    const updatedRows = await sql`
      UPDATE tenants
      SET status = 'archived'
      WHERE id = ${tenantId}
      RETURNING id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
    `;

    const updatedTenant = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "tenant.archive",
      entityType: "tenant",
      entityId: tenantId,
      oldValues: tenant,
      newValues: updatedTenant,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ tenant: updatedTenant });
  } catch (error) {
    console.error("POST /api/tenants/[id]/archive error", error);
    return Response.json(
      { error: "Failed to archive tenant" },
      { status: 500 },
    );
  }
}
