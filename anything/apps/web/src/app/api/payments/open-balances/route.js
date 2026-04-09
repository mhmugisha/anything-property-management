import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

/**
 * GET /api/payments/open-balances
 *
 * Returns all tenant balances that are not fully settled.
 *
 * Query params:
 * - propertyId (optional): filter by property
 * - dateFilter: "all" (default), "overdue", "current"
 * - fromDate (optional): filter invoices from this date
 * - toDate (optional): filter invoices to this date
 */
export async function GET(request) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const dateFilter = searchParams.get("dateFilter") || "all";
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Build WHERE clauses
    const whereClauses = [
      "(i.amount - i.paid_amount) > 0",
      "i.status NOT IN ('void', 'paid')",
      "COALESCE(i.is_deleted, false) = false",
    ];
    const params = [];

    // Property filter
    if (propertyId && propertyId !== "") {
      params.push(Number(propertyId));
      whereClauses.push(`i.property_id = $${params.length}`);
    }

    // Date range filter (on invoice_date)
    if (fromDate) {
      params.push(fromDate);
      whereClauses.push(`i.invoice_date >= $${params.length}`);
    }
    if (toDate) {
      params.push(toDate);
      whereClauses.push(`i.invoice_date <= $${params.length}`);
    }

    // Date filter: overdue or current
    if (dateFilter === "overdue") {
      whereClauses.push("i.due_date < CURRENT_DATE");
    } else if (dateFilter === "current") {
      whereClauses.push("i.due_date >= CURRENT_DATE");
    }
    // "all" = no additional date filter

    const whereClause = whereClauses.join(" AND ");

    const query = `
      SELECT
        i.id AS invoice_id,
        i.tenant_id,
        i.property_id,
        i.unit_id,
        i.invoice_date,
        i.due_date,
        i.amount,
        i.paid_amount,
        (i.amount - i.paid_amount) AS outstanding_balance,
        t.full_name AS tenant_name,
        t.phone AS tenant_phone,
        u.unit_number,
        p.property_name,
        CASE
          WHEN i.due_date < CURRENT_DATE THEN 'overdue'
          ELSE 'current'
        END AS status
      FROM invoices i
      LEFT JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN properties p ON p.id = i.property_id
      WHERE ${whereClause}
      ORDER BY i.due_date ASC, i.invoice_date ASC
    `;

    const rows = await sql(query, params);

    // Calculate total
    const total = rows.reduce(
      (sum, row) => sum + Number(row.outstanding_balance || 0),
      0,
    );

    return Response.json({
      rows: rows || [],
      total,
      filters: {
        propertyId,
        dateFilter,
        fromDate,
        toDate,
      },
    });
  } catch (error) {
    console.error("GET /api/payments/open-balances error", error);
    return Response.json(
      { error: "Failed to fetch open balances" },
      { status: 500 },
    );
  }
}
