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

    const leaseRows = await sql`
      SELECT *
      FROM leases
      WHERE tenant_id = ${tenantId}
        AND status = 'active'
      ORDER BY start_date DESC
      LIMIT 1
    `;

    const lease = leaseRows?.[0] || null;
    if (!lease) {
      return Response.json(
        { error: "No active lease found for this tenant" },
        { status: 400 },
      );
    }

    const endedLeaseRows = await sql`
      UPDATE leases
      SET status = 'ended',
          auto_renew = false,
          end_date = CASE
            WHEN end_date > CURRENT_DATE THEN CURRENT_DATE
            ELSE end_date
          END
      WHERE id = ${lease.id}
      RETURNING *
    `;

    const endedLease = endedLeaseRows?.[0] || null;

    // Make unit vacant
    if (lease.unit_id) {
      await sql`UPDATE units SET status = 'vacant' WHERE id = ${lease.unit_id}`;
    }

    // Void invoices after today (if any were created ahead of time)
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
      newValues: endedLease,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ lease: endedLease });
  } catch (error) {
    console.error("POST /api/tenants/[id]/end-lease error", error);
    return Response.json({ error: "Failed to end lease" }, { status: 500 });
  }
}
