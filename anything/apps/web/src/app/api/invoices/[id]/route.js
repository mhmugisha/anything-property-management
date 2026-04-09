import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoiceAccrualLedgerEntries } from "@/app/api/utils/invoices/invoiceAccrualLedger";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const invoiceId = toNumber(params.id);
    if (!invoiceId) {
      return Response.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const staffId = perm.staff?.id;
    if (!staffId) {
      return Response.json({ error: "Staff ID required" }, { status: 401 });
    }

    // Fetch the invoice
    const invoiceRows = await sql`
      SELECT * FROM invoices WHERE id = ${invoiceId} LIMIT 1
    `;

    const invoice = invoiceRows?.[0];
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Check if already deleted (idempotent)
    if (invoice.is_deleted === true) {
      return Response.json({
        ok: true,
        message: "Invoice already deleted",
        alreadyDeleted: true,
      });
    }

    // SAFETY CHECK: Block deletion if invoice has any payments applied
    const paidAmount = Number(invoice.paid_amount || 0);
    if (paidAmount > 0) {
      return Response.json(
        {
          error:
            "Cannot delete invoice with payments applied. Please reverse the payments first.",
          paidAmount,
        },
        { status: 400 },
      );
    }

    // Double-check payment allocations (extra safety)
    const allocRows = await sql`
      SELECT COUNT(*) as count
      FROM payment_invoice_allocations
      WHERE invoice_id = ${invoiceId}
    `;

    const allocCount = Number(allocRows?.[0]?.count || 0);
    if (allocCount > 0) {
      return Response.json(
        {
          error:
            "Cannot delete invoice with payment allocations. Please remove allocations first.",
        },
        { status: 400 },
      );
    }

    // Soft-delete the invoice
    await sql`
      UPDATE invoices
      SET is_deleted = true,
          deleted_at = now(),
          deleted_by = ${staffId}
      WHERE id = ${invoiceId}
    `;

    // Re-sync accounting for this invoice's property-month
    // This will recalculate the monthly summary without the deleted invoice
    if (invoice.lease_id) {
      try {
        await ensureInvoiceAccrualLedgerEntries({
          force: true,
          leaseId: invoice.lease_id,
        });
      } catch (e) {
        console.error("Failed to re-sync accounting after invoice deletion", e);
        // Continue - deletion succeeded, accounting can be manually synced later
      }
    }

    // Write audit log
    await writeAuditLog({
      staffId,
      action: "invoice.delete",
      entityType: "invoice",
      entityId: invoiceId,
      oldValues: invoice,
      newValues: { ...invoice, is_deleted: true },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/invoices/[id] error", error);
    return Response.json(
      { error: error?.message || "Failed to delete invoice" },
      { status: 500 },
    );
  }
}
