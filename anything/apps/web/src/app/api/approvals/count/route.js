import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

// GET /api/approvals/count — total pending items for the nav badge (Admin only).
// Same access and the same filters as GET /api/approvals, but returns one number.
export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff.role_name !== 'Admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await sql`
      SELECT
        (SELECT COUNT(*) FROM payments
          WHERE approval_status = 'pending' AND is_reversed = false)
        + (SELECT COUNT(*) FROM invoices
          WHERE approval_status = 'pending' AND COALESCE(is_deleted, false) = false)
        + (SELECT COUNT(*) FROM transactions
          WHERE approval_status = 'pending' AND COALESCE(is_deleted, false) = false)
        + (SELECT COUNT(*) FROM tenant_deductions
          WHERE approval_status = 'pending' AND COALESCE(is_deleted, false) = false)
        + (SELECT COUNT(*) FROM landlord_deductions
          WHERE approval_status = 'pending' AND COALESCE(is_deleted, false) = false)
        + (SELECT COUNT(*) FROM landlords WHERE approval_status = 'pending')
        + (SELECT COUNT(*) FROM properties WHERE approval_status = 'pending')
        + (SELECT COUNT(*) FROM tenant_submissions)
        AS total
    `;

    return Response.json({ total: Number(rows?.[0]?.total || 0) });
  } catch (error) {
    console.error('GET /api/approvals/count error', error);
    return Response.json({ error: 'Failed to count pending approvals' }, { status: 500 });
  }
}
