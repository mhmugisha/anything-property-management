import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import {
  getLeaseDepositBalance,
  getTenantPrepaymentBalance,
} from "@/app/api/utils/accounting";

// Preview for decommissioning a property: the active leases that must be
// cleared (ended, later transferred) before the property can be archived.
export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const propertyId = parseInt(id, 10);
    if (!Number.isFinite(propertyId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const propertyRows = await sql`
      SELECT id, property_name, address, landlord_id,
             COALESCE(is_deleted, false) AS is_archived
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `;
    const property = propertyRows?.[0] || null;
    if (!property) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const leaseRows = await sql`
      SELECT
        l.id AS lease_id,
        l.tenant_id,
        t.full_name AS tenant_name,
        u.unit_number,
        l.end_date,
        COALESCE(inv.outstanding, 0) AS outstanding
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN tenants t ON t.id = l.tenant_id
      LEFT JOIN LATERAL (
        SELECT SUM(i.amount - i.paid_amount) AS outstanding
        FROM invoices i
        WHERE i.lease_id = l.id
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
      ) inv ON true
      WHERE u.property_id = ${propertyId}
        AND l.status = 'active'
      ORDER BY u.unit_number, l.id
    `;

    const activeLeases = await Promise.all(
      (leaseRows || []).map(async (r) => {
        const [depositHeld, prepayment] = await Promise.all([
          getLeaseDepositBalance(r.lease_id),
          getTenantPrepaymentBalance(r.tenant_id),
        ]);
        return {
          lease_id: Number(r.lease_id),
          tenant_id: Number(r.tenant_id),
          tenant_name: r.tenant_name,
          unit_number: r.unit_number,
          end_date: r.end_date,
          outstanding: Number(r.outstanding || 0),
          deposit_held: Number(depositHeld || 0),
          // Tenant-wide: includes prepayments for the tenant's other leases.
          prepayment: Number(prepayment || 0),
        };
      }),
    );

    return Response.json({
      property: {
        id: Number(property.id),
        property_name: property.property_name,
        address: property.address,
        landlord_id: property.landlord_id ? Number(property.landlord_id) : null,
        is_archived: property.is_archived === true,
      },
      blocked: activeLeases.length > 0,
      active_leases: activeLeases,
    });
  } catch (error) {
    console.error("GET /api/properties/[id]/decommission-summary error", error);
    return Response.json(
      { error: "Failed to load decommission summary" },
      { status: 500 },
    );
  }
}
