import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = Number(searchParams.get("tenantId"));

    if (!tenantId) {
      return Response.json({ error: "tenantId is required" }, { status: 400 });
    }

    const tenantRows = await sql`
      SELECT id, full_name, phone, email
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    const tenant = tenantRows?.[0] || null;
    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    // REMOVED: ensureInvoicesForTenant(tenantId)
    // This was auto-allocating upfront payments every time the statement was viewed,
    // so upfront payments never showed as "Upfront" in the statement.
    // Invoice generation should happen via scheduled jobs or explicit actions, not on every read.

    const [leases, invoices, deductions] = await Promise.all([
      sql`
      SELECT l.*, u.unit_number, p.property_name
      FROM leases l
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN properties p ON u.property_id = p.id
      WHERE l.tenant_id = ${tenantId}
      ORDER BY l.start_date DESC
      LIMIT 50
    `,

    // IMPORTANT: This query includes ALL invoice types for the tenant:
    // 1. Automatic monthly rent invoices (lease_id IS NOT NULL, generated via cron/API)
    // 2. Manual invoices (lease_id IS NOT NULL, created via Post Manual Invoice)
    // 3. Arrears invoices (lease_id IS NULL, created via Post Arrears)
    // The statement totals (Debits, Credits, Closing Balance) are calculated from ALL these invoices.
    // All invoices for this tenant_id will appear in the statement regardless of type or source.
    sql`
      SELECT
        i.*, 
        (i.amount - i.paid_amount) AS outstanding,
        p.property_name,
        u.unit_number
      FROM invoices i
      LEFT JOIN properties p ON p.id = i.property_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE i.tenant_id = ${tenantId}
        AND COALESCE(i.is_deleted, false) = false
      ORDER BY i.invoice_year DESC, i.invoice_month DESC, i.id DESC
      LIMIT 60
    `,

      sql`
      SELECT id, deduction_date, description, amount
      FROM tenant_deductions
      WHERE tenant_id = ${tenantId}
        AND COALESCE(is_deleted, false) = false
      ORDER BY deduction_date DESC, id DESC
    `,
    ]);

    // Get all payments for this tenant with their allocations (if any)
    // This query returns:
    // - One row per allocation (with invoice details)
    // - One additional row for any unallocated portion (with NULL invoice fields)
    // So a $100 payment split as $60 to invoice A + $40 unallocated will show:
    //   - Row 1: $60 allocated to "Invoice A"
    //   - Row 2: $40 unallocated ("Upfront")
    const payments = await sql`
      WITH payment_allocations AS (
        SELECT
          p.id AS payment_id,
          p.payment_date,
          p.amount AS total_amount,
          p.payment_method,
          p.notes,
          p.reference_number,
          pia.invoice_id,
          pia.amount_applied,
          i.description AS invoice_description
        FROM payments p
        LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
        LEFT JOIN invoices i ON i.id = pia.invoice_id
        WHERE p.tenant_id = ${tenantId}
          AND p.is_reversed = false
      ),
      allocated_amounts AS (
        SELECT
          payment_id,
          SUM(amount_applied) AS total_allocated
        FROM payment_allocations
        WHERE invoice_id IS NOT NULL
        GROUP BY payment_id
      ),
      unallocated_rows AS (
        SELECT
          pa.payment_id AS id,
          pa.payment_date,
          pa.total_amount AS amount,
          pa.payment_method,
          pa.notes,
          pa.reference_number,
          NULL::integer AS invoice_id,
          (pa.total_amount - COALESCE(aa.total_allocated, 0)) AS invoice_amount_applied,
          NULL::text AS invoice_description
        FROM payment_allocations pa
        LEFT JOIN allocated_amounts aa ON aa.payment_id = pa.payment_id
        WHERE (pa.total_amount - COALESCE(aa.total_allocated, 0)) > 0
        GROUP BY pa.payment_id, pa.payment_date, pa.total_amount, 
                 pa.payment_method, pa.notes, pa.reference_number, aa.total_allocated
      ),
      allocated_rows AS (
        SELECT DISTINCT
          payment_id AS id,
          payment_date,
          total_amount AS amount,
          payment_method,
          notes,
          reference_number,
          invoice_id,
          amount_applied AS invoice_amount_applied,
          invoice_description
        FROM payment_allocations
        WHERE invoice_id IS NOT NULL
      )
      SELECT * FROM allocated_rows
      UNION ALL
      SELECT * FROM unallocated_rows
      ORDER BY payment_date DESC, id DESC, invoice_id ASC NULLS LAST
    `;

    return Response.json({ tenant, leases, invoices, payments, deductions });
  } catch (error) {
    console.error("GET /api/reports/tenant-statement error", error);
    return Response.json(
      { error: "Failed to build tenant statement" },
      { status: 500 },
    );
  }
}
