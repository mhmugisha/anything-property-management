import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

const ALLOWED_TYPES = ['payments', 'invoices', 'transactions', 'tenant_deductions', 'landlord_deductions', 'landlords', 'properties', 'tenants'];

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  if (perm.staff.role_name !== 'Admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { type, id } = params;
  const entryId = Number(id);

  if (!ALLOWED_TYPES.includes(type) || !Number.isFinite(entryId)) {
    return Response.json({ error: 'Invalid type or id' }, { status: 400 });
  }

  const body = await request.json();
  const action = body?.action; // 'approve' or 'reject'
  const rejectedReason = body?.rejected_reason || null;

  if (!['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  try {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    const query = `
      UPDATE ${type}
      SET approval_status = $1,
          approved_by = $2,
          approved_at = $3,
          rejected_reason = $4
      WHERE id = $5
      RETURNING *
    `;

    const rows = await sql(query, [
      newStatus,
      perm.staff.id,
      now,
      rejectedReason,
      entryId,
    ]);

    const entry = rows?.[0] || null;
    if (!entry) {
      return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    return Response.json({ ok: true, entry, action });
  } catch (error) {
    console.error(`POST /api/approvals/${type}/${id} error`, error);
    return Response.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
