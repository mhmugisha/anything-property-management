import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { pendingCompletionWhere } from "@/app/api/utils/maintenance/completionApproval";

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
      tenantSubmissionRows,
      unitSubmissionRows,
      maintenanceCompletionRows,
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
      // New units proposed by non-admins. Nothing exists in units until
      // approval. Admin-only route, so landlord payout details are included.
      sql`
        SELECT us.id,
               us.property_id,
               us.unit_number,
               us.bedrooms,
               us.bathrooms,
               us.square_feet,
               us.monthly_rent_ugx,
               us.monthly_rent_usd,
               us.deposit_amount,
               us.photos,
               us.requested_by,
               us.requested_at,
               s.full_name AS created_by_name,
               p.property_name,
               p.address AS property_address,
               p.management_fee_type,
               p.management_fee_percent,
               p.management_fee_fixed_amount,
               COALESCE(p.is_deleted, false) AS property_archived,
               l.id AS landlord_id,
               CASE WHEN l.id IS NULL THEN NULL
                    ELSE CONCAT_WS(' ', NULLIF(l.title, ''), l.full_name) END AS landlord_name,
               l.payment_method AS landlord_payment_method,
               l.bank_name AS landlord_bank_name,
               l.bank_account_title AS landlord_bank_account_title,
               l.bank_account_number AS landlord_bank_account_number,
               l.mobile_money_name AS landlord_mobile_money_name,
               l.mobile_money_phone AS landlord_mobile_money_phone,
               l.start_date AS landlord_start_date,
               l.end_date AS landlord_end_date,
               (CASE WHEN l.due_date IS NULL THEN NULL
                     ELSE EXTRACT(day FROM l.due_date)::int END) AS landlord_due_day,
               (
                 COALESCE(NULLIF(TRIM(l.bank_name), ''), NULLIF(TRIM(l.bank_account_title), ''),
                          NULLIF(TRIM(l.bank_account_number), ''), NULLIF(TRIM(l.mobile_money_name), ''),
                          NULLIF(TRIM(l.mobile_money_phone), '')) IS NULL
               ) AS landlord_has_no_payout_details
        FROM unit_submissions us
        LEFT JOIN staff_users s ON s.id = us.requested_by
        LEFT JOIN properties p ON p.id = us.property_id
        LEFT JOIN landlords l ON l.id = p.landlord_id
        ORDER BY us.requested_at DESC, us.id DESC
      `,
      // Maintenance jobs completed by non-admins with a cost: nothing is
      // posted to the GL until approved (see utils/maintenance/completionApproval).
      sql(`
        SELECT m.*,
               p.property_name,
               u.unit_number,
               t.full_name AS tenant_name,
               coa.account_code AS payment_account_code,
               coa.account_name AS payment_account_name,
               (SELECT s.full_name FROM audit_logs al
                  JOIN staff_users s ON s.id = al.user_id
                 WHERE al.entity_type = 'maintenance_request'
                   AND al.entity_id = m.id
                   AND al.action = 'maintenance.submit_completion'
                 ORDER BY al.id DESC LIMIT 1) AS created_by_name
        FROM maintenance_requests m
        LEFT JOIN properties p ON p.id = m.property_id
        LEFT JOIN units u ON u.id = m.unit_id
        LEFT JOIN tenants t ON t.id = m.tenant_id
        LEFT JOIN chart_of_accounts coa ON coa.id = m.payment_account_id
        WHERE ${pendingCompletionWhere("m")}
        ORDER BY m.completed_at DESC NULLS LAST, m.id DESC
      `, []),
    ]);

    const tenantSubmissions = tenantSubmissionRows || [];
    const unitSubmissions = unitSubmissionRows || [];
    const maintenanceCompletions = maintenanceCompletionRows || [];

    return Response.json({
      payments,
      invoices,
      transactions,
      tenantDeductions,
      landlordDeductions,
      tenantSubmissions,
      unitSubmissions,
      maintenanceCompletions,
    });
  } catch (error) {
    console.error('GET /api/approvals error', error);
    return Response.json({ error: 'Failed to fetch pending approvals' }, { status: 500 });
  }
}
