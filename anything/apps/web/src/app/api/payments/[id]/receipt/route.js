import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "payments");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const paymentId = Number(params.id);

    if (!paymentId || isNaN(paymentId)) {
      return Response.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    // Fetch payment with all related details
    const paymentRows = await sql`
      SELECT
        p.*,
        t.full_name AS tenant_name,
        t.phone AS tenant_phone,
        t.email AS tenant_email,
        pr.property_name,
        pr.address AS property_address,
        u.unit_number,
        s.full_name AS recorded_by_name
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN properties pr ON p.property_id = pr.id
      LEFT JOIN leases l ON p.lease_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN staff_users s ON p.recorded_by = s.id
      WHERE p.id = ${paymentId}
      LIMIT 1
    `;

    if (paymentRows.length === 0) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = paymentRows[0];

    // Fetch invoice allocations
    const allocations = await sql`
      SELECT
        pia.amount_applied,
        i.id AS invoice_id,
        i.description AS invoice_description,
        i.invoice_month,
        i.invoice_year,
        i.amount AS invoice_amount,
        i.due_date
      FROM payment_invoice_allocations pia
      JOIN invoices i ON i.id = pia.invoice_id
      WHERE pia.payment_id = ${paymentId}
      ORDER BY i.invoice_date
    `;

    // Calculate tenant's outstanding balance (unpaid amount)
    const balanceRows = await sql`
      SELECT COALESCE(SUM(amount - paid_amount), 0)::numeric AS outstanding_balance
      FROM invoices
      WHERE tenant_id = ${payment.tenant_id}
        AND status = 'open'
        AND (amount - paid_amount) > 0
    `;

    const outstandingBalance = Number(
      balanceRows?.[0]?.outstanding_balance || 0,
    );

    return Response.json({
      payment: {
        ...payment,
        invoice_allocations: allocations || [],
        outstanding_balance: outstandingBalance,
      },
    });
  } catch (error) {
    console.error("GET /api/payments/[id]/receipt error", error);
    return Response.json(
      { error: "Failed to fetch payment receipt" },
      { status: 500 },
    );
  }
}
