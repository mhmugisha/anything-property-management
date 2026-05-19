import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { createNotification } from "@/app/api/utils/notifications";

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

    // Fetch current entry to capture old approval_status before modifying it
    const existingRows = await sql(`SELECT * FROM ${type} WHERE id = $1`, [entryId]);
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Guard: reject only if the entry is not already approved
    if (action === 'reject' && existing.approval_status === 'approved') {
      return Response.json({
        error: 'Cannot reject an already-approved entry. This indicates an unexpected state; please contact support.',
      }, { status: 409 });
    }

    const previousApprovalStatus = existing.approval_status;

    const updateQuery = `
      UPDATE ${type}
      SET approval_status = $1,
          approved_by = $2,
          approved_at = $3,
          rejected_reason = $4
      WHERE id = $5
      RETURNING *
    `;

    const rows = await sql(updateQuery, [
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

    // Rejection cleanup: undo downstream effects so the entry exits the books entirely
    if (action === 'reject') {
      let cleanupSummary = {};

      if (type === 'payments') {
        const [deletedTxns, updatedInvoices, deletedAllocations] = await sql.transaction([
          sql`UPDATE transactions SET is_deleted = true
              WHERE source_type = ANY(ARRAY['payment','payment_advance']::text[])
                AND source_id = ${entryId}
              RETURNING id`,
          sql`UPDATE invoices i
              SET paid_amount = GREATEST(0, i.paid_amount - pia.total_applied),
                  status = CASE
                    WHEN GREATEST(0, i.paid_amount - pia.total_applied) < i.amount THEN 'open'
                    ELSE i.status
                  END
              FROM (
                SELECT invoice_id, SUM(amount_applied) AS total_applied
                FROM payment_invoice_allocations
                WHERE payment_id = ${entryId}
                GROUP BY invoice_id
              ) pia
              WHERE i.id = pia.invoice_id
              RETURNING i.id`,
          sql`DELETE FROM payment_invoice_allocations WHERE payment_id = ${entryId} RETURNING id`,
          sql`UPDATE payments SET is_reversed = true WHERE id = ${entryId}`,
        ]);
        cleanupSummary = {
          ledger_txns_deleted: deletedTxns?.length ?? 0,
          invoices_restored: updatedInvoices?.length ?? 0,
          allocations_deleted: deletedAllocations?.length ?? 0,
        };
        console.log(`Rejected payments ${entryId}: soft-deleted ledger txns=${cleanupSummary.ledger_txns_deleted}, allocations reversed=${cleanupSummary.allocations_deleted}, invoices updated=${cleanupSummary.invoices_restored}`);
      }

      else if (type === 'transactions') {
        const deleted = await sql`UPDATE transactions SET is_deleted = true WHERE id = ${entryId} RETURNING id`;
        cleanupSummary = { ledger_txns_deleted: deleted?.length ?? 0 };
        console.log(`Rejected transactions ${entryId}: soft-deleted ledger txns=${cleanupSummary.ledger_txns_deleted}`);
      }

      else if (type === 'tenant_deductions') {
        const [deletedDeduction, deletedTxns] = await sql.transaction([
          sql`UPDATE tenant_deductions SET is_deleted = true WHERE id = ${entryId} RETURNING id`,
          sql`UPDATE transactions SET is_deleted = true WHERE source_type = 'tenant_deduction' AND source_id = ${entryId} RETURNING id`,
        ]);
        cleanupSummary = {
          deduction_deleted: deletedDeduction?.length ?? 0,
          ledger_txns_deleted: deletedTxns?.length ?? 0,
        };
        console.log(`Rejected tenant_deductions ${entryId}: soft-deleted ledger txns=${cleanupSummary.ledger_txns_deleted}`);
      }

      else if (type === 'landlord_deductions') {
        const [deletedDeduction, deletedTxns] = await sql.transaction([
          sql`UPDATE landlord_deductions SET is_deleted = true WHERE id = ${entryId} RETURNING id`,
          sql`UPDATE transactions SET is_deleted = true WHERE source_type = 'landlord_deduction' AND source_id = ${entryId} RETURNING id`,
        ]);
        cleanupSummary = {
          deduction_deleted: deletedDeduction?.length ?? 0,
          ledger_txns_deleted: deletedTxns?.length ?? 0,
        };
        console.log(`Rejected landlord_deductions ${entryId}: soft-deleted ledger txns=${cleanupSummary.ledger_txns_deleted}`);
      }

      await writeAuditLog({
        staffId: perm.staff.id,
        action: `approval.${action}`,
        entityType: type,
        entityId: entryId,
        oldValues: { previous_approval_status: previousApprovalStatus },
        newValues: { rejected_reason: rejectedReason, cleanup_summary: cleanupSummary },
        ipAddress: perm.ipAddress,
      });
    }

    if (action === 'reject' && type !== 'invoices') {
      const creatorId =
        type === 'payments' ? entry.recorded_by : entry.created_by;

      const messageMap = {
        payments: `Your payment of UGX ${Number(entry.amount || 0).toLocaleString()} on ${String(entry.payment_date || '').slice(0, 10)} has not been approved. Please contact admin.`,
        transactions: `Your journal entry of UGX ${Number(entry.amount || 0).toLocaleString()} (${entry.description || ''}) has not been approved. Please contact admin.`,
        tenant_deductions: `Your tenant deduction of UGX ${Number(entry.amount || 0).toLocaleString()} (${entry.description || ''}) has not been approved. Please contact admin.`,
        landlord_deductions: `Your landlord deduction of UGX ${Number(entry.amount || 0).toLocaleString()} (${entry.description || ''}) has not been approved. Please contact admin.`,
        landlords: `The landlord '${entry.full_name || ''}' you added has not been approved. Please contact admin.`,
        properties: `The property '${entry.property_name || ''}' you added has not been approved. Please contact admin.`,
        tenants: `The tenant '${entry.full_name || ''}' you added has not been approved. Please contact admin.`,
      };

      const message = messageMap[type];

      if (creatorId && message) {
        try {
          createNotification({
            user_id: creatorId,
            title: 'Entry Not Approved',
            message,
            type: 'approval',
            reference_id: entryId,
            reference_type: type,
          });
        } catch (notifError) {
          console.error('createNotification failed (non-blocking)', notifError);
        }
      }
    }

    return Response.json({ ok: true, entry, action });
  } catch (error) {
    console.error(`POST /api/approvals/${type}/${id} error`, error);
    return Response.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
