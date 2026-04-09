import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { ensureInvoicesForTenant } from "@/app/api/utils/invoices";

export async function GET(request) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = Number(searchParams.get("tenantId"));

    if (!tenantId) {
      return Response.json({ invoices: [] });
    }

    // Make sure monthly invoices exist (includes current month)
    await ensureInvoicesForTenant(tenantId);

    const invoices = await sql`
      SELECT
        i.id,
        i.tenant_id,
        i.lease_id,
        i.property_id,
        i.unit_id,
        i.invoice_date,
        i.due_date,
        i.invoice_month,
        i.invoice_year,
        i.description,
        i.amount,
        i.paid_amount,
        (i.amount - i.paid_amount) AS outstanding,
        i.currency,
        i.status,
        p.property_name,
        u.unit_number
      FROM invoices i
      LEFT JOIN properties p ON p.id = i.property_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE i.tenant_id = ${tenantId}
        AND (i.amount - i.paid_amount) > 0
        AND i.status NOT IN ('void', 'paid')
        AND COALESCE(i.is_deleted, false) = false
      ORDER BY i.invoice_year DESC, i.invoice_month DESC, i.id DESC
      LIMIT 36
    `;

    return Response.json({ invoices });
  } catch (error) {
    console.error("GET /api/invoices/due error", error);
    return Response.json(
      { error: "Failed to fetch due invoices" },
      { status: 500 },
    );
  }
}
