import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

// GET /api/approvals — fetch all pending entries (Admin only)
export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff.role_name !== 'Admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [
      payments,
      invoices,
      transactions,
      tenantDeductions,
      landlordDeductions,
      landlordRows,
      propertyRows,
      tenantSubmissionRows,
    ] = await Promise.all([
      sql`
        SELECT p.*, s.full_name AS created_by_name, t.full_name AS tenant_name,
               pr.property_name
        FROM payments p
        LEFT JOIN staff_users s ON s.id = p.recorded_by
        LEFT JOIN tenants t ON t.id = p.tenant_id
        LEFT JOIN properties pr ON pr.id = p.property_id
        WHERE p.approval_status = 'pending'
          AND p.is_reversed = false
        ORDER BY p.created_at DESC
      `,
      sql`
        SELECT i.*, s.full_name AS created_by_name, t.full_name AS tenant_name,
               pr.property_name
        FROM invoices i
        LEFT JOIN staff_users s ON s.id = i.deleted_by
        LEFT JOIN tenants t ON t.id = i.tenant_id
        LEFT JOIN properties pr ON pr.id = i.property_id
        WHERE i.approval_status = 'pending'
          AND COALESCE(i.is_deleted, false) = false
        ORDER BY i.created_at DESC
      `,
      sql`
        SELECT t.*, s.full_name AS created_by_name
        FROM transactions t
        LEFT JOIN staff_users s ON s.id = t.created_by
        WHERE t.approval_status = 'pending'
          AND COALESCE(t.is_deleted, false) = false
        ORDER BY t.created_at DESC
      `,
      sql`
        SELECT td.*, s.full_name AS created_by_name, t.full_name AS tenant_name,
               pr.property_name
        FROM tenant_deductions td
        LEFT JOIN staff_users s ON s.id = td.created_by
        LEFT JOIN tenants t ON t.id = td.tenant_id
        LEFT JOIN properties pr ON pr.id = td.property_id
        WHERE td.approval_status = 'pending'
          AND COALESCE(td.is_deleted, false) = false
        ORDER BY td.created_at DESC
      `,
      sql`
        SELECT ld.*, s.full_name AS created_by_name, l.full_name AS landlord_name,
               pr.property_name
        FROM landlord_deductions ld
        LEFT JOIN staff_users s ON s.id = ld.created_by
        LEFT JOIN landlords l ON l.id = ld.landlord_id
        LEFT JOIN properties pr ON pr.id = ld.property_id
        WHERE ld.approval_status = 'pending'
          AND COALESCE(ld.is_deleted, false) = false
        ORDER BY ld.created_at DESC
      `,
      sql`
        SELECT l.*, s.full_name AS created_by_name
        FROM landlords l
        LEFT JOIN staff_users s ON s.id = l.created_by
        WHERE l.approval_status = 'pending'
        ORDER BY l.created_at DESC
      `,
      sql`
        SELECT p.*, s.full_name AS created_by_name,
               l.full_name AS landlord_name
        FROM properties p
        LEFT JOIN staff_users s ON s.id = p.created_by
        LEFT JOIN landlords l ON l.id = p.landlord_id
        WHERE p.approval_status = 'pending'
        ORDER BY p.created_at DESC
      `,
      // New tenants submitted by non-admins. Nothing exists in tenants/leases
      // until approval; unit_available re-runs the overlap test live.
      sql`
        SELECT ts.*,
               s.full_name AS created_by_name,
               u.unit_number,
               p.id AS property_id,
               p.property_name,
               l.full_name AS landlord_name,
               (
                 COALESCE(p.is_deleted, false) = false
                 AND NOT EXISTS (
                   SELECT 1 FROM leases ol
                   WHERE ol.unit_id = ts.unit_id
                     AND ol.status = 'active'
                     AND ol.start_date <= ts.end_date
                     AND ol.end_date >= ts.start_date
                 )
               ) AS unit_available
        FROM tenant_submissions ts
        LEFT JOIN staff_users s ON s.id = ts.requested_by
        LEFT JOIN units u ON u.id = ts.unit_id
        LEFT JOIN properties p ON p.id = u.property_id
        LEFT JOIN landlords l ON l.id = p.landlord_id
        ORDER BY ts.requested_at DESC
      `,
    ]);

    const landlords = landlordRows || [];
    const properties = propertyRows || [];
    const tenantSubmissions = tenantSubmissionRows || [];

    return Response.json({
      payments,
      invoices,
      transactions,
      tenantDeductions,
      landlordDeductions,
      landlords,
      properties,
      tenantSubmissions,
    });
  } catch (error) {
    console.error('GET /api/approvals error', error);
    return Response.json({ error: 'Failed to fetch pending approvals' }, { status: 500 });
  }
}
