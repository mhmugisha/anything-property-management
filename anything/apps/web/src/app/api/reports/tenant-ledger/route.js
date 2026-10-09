import sql from "@/app/api/utils/sql";
import { getStaffContext, hasPermission } from "@/app/api/utils/staff";

function toNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toDateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function GET(request) {
  // This endpoint is used in both Reports and Tenants screens.
  // Allow staff who can either view reports OR manage tenants.
  const { session, staff, permissions } = await getStaffContext(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!staff || staff.is_active === false) {
    return Response.json(
      { error: "Staff profile not set up" },
      { status: 403 },
    );
  }

  const canView =
    hasPermission(permissions, "reports") ||
    hasPermission(permissions, "tenants");
  if (!canView) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = toNumber(searchParams.get("tenantId"));
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    if (!tenantId) {
      return Response.json({ error: "tenantId is required" }, { status: 400 });
    }

    const tenantRows = await sql`
      SELECT id, title, full_name, phone, email
      FROM tenants
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    const tenant = tenantRows?.[0] || null;
    if (!tenant)
      return Response.json({ error: "Tenant not found" }, { status: 404 });

    // NEW: Get the active or most recent lease to fetch unit_number and property_name
    const leaseRows = await sql`
      SELECT l.id, l.unit_id, u.unit_number, p.property_name
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.tenant_id = ${tenantId}
      ORDER BY 
        CASE WHEN l.status = 'active' THEN 1 ELSE 2 END,
        l.start_date DESC
      LIMIT 1
    `;

    const lease = leaseRows?.[0] || null;
    const unitNumber = lease?.unit_number || null;
    const propertyName = lease?.property_name || null;

    // REMOVED: ensureInvoicesForTenant - this is a report and shouldn't modify data

    const openingFrom = from ? from : "1900-01-01";

    // A void invoice is charged its paid portion only (0 if nothing was paid),
    // so money paid against a later-voided invoice still nets out.
    const openingInvoiceRows = await sql`
      SELECT COALESCE(SUM(CASE WHEN status = 'void' THEN COALESCE(paid_amount, 0) ELSE amount END), 0) AS total
      FROM invoices
      WHERE tenant_id = ${tenantId}
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND invoice_date < ${openingFrom}::date
    `;

    // FIX: Include ALL payments in opening balance, not just allocated ones
    const openingPaymentRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE tenant_id = ${tenantId}
        AND is_reversed = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND payment_date < ${openingFrom}::date
    `;

    const openingDedRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM tenant_deductions
      WHERE tenant_id = ${tenantId}
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND deduction_date < ${openingFrom}::date
    `;

    const openingDebits =
      Number(openingInvoiceRows?.[0]?.total || 0) +
      Number(openingDedRows?.[0]?.total || 0);
    const openingCredits = Number(openingPaymentRows?.[0]?.total || 0);

    const openingBalance = openingDebits - openingCredits;

    const invoiceWhere = [
      `i.tenant_id = $1`,
      `COALESCE(i.is_deleted, false) = false`,
      `COALESCE(i.approval_status, 'approved') = 'approved'`,
    ];
    const invoiceValues = [tenantId];

    if (from) {
      invoiceWhere.push(`i.invoice_date >= $${invoiceValues.length + 1}::date`);
      invoiceValues.push(from);
    }

    if (to) {
      invoiceWhere.push(`i.invoice_date <= $${invoiceValues.length + 1}::date`);
      invoiceValues.push(to);
    }

    // IMPORTANT: This query includes BOTH regular rent invoices (lease_id IS NOT NULL)
    // AND arrears invoices (lease_id IS NULL). Both types should appear as debits.
    const invoiceQuery = `
      SELECT i.id, i.invoice_date, i.description, i.lease_id,
             CASE WHEN i.status = 'void' THEN COALESCE(i.paid_amount, 0) ELSE i.amount END AS amount
      FROM invoices i
      WHERE ${invoiceWhere.join(" AND ")}
      ORDER BY i.invoice_date ASC, i.id ASC
    `;

    const invoices = await sql(invoiceQuery, invoiceValues);

    const invoiceRows = invoices.map((i) => ({
      kind: "invoice",
      invoice_id: i.id,
      date: toDateStr(i.invoice_date),
      description: i.description,
      debit: Number(i.amount || 0),
      credit: 0,
    }));

    // FIX: Show ALL payments including unallocated/upfront payments
    const payWhere = [`p.tenant_id = $1`, `p.is_reversed = false`, `COALESCE(p.approval_status, 'approved') = 'approved'`];
    const payValues = [tenantId];

    if (from) {
      payWhere.push(`p.payment_date >= $${payValues.length + 1}::date`);
      payValues.push(from);
    }

    if (to) {
      payWhere.push(`p.payment_date <= $${payValues.length + 1}::date`);
      payValues.push(to);
    }

    // Query that shows both allocated and unallocated portions of payments
    const payQuery = `
      SELECT 
        p.id,
        p.payment_date,
        p.payment_method,
        p.reference_number,
        p.amount AS total_payment_amount,
        pia.invoice_id,
        pia.amount_applied,
        i.description AS invoice_description
      FROM payments p
      LEFT JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
      LEFT JOIN invoices i ON i.id = pia.invoice_id
      WHERE ${payWhere.join(" AND ")}
      ORDER BY p.payment_date ASC, p.id ASC, pia.id ASC
    `;

    const paymentDetails = await sql(payQuery, payValues);

    // Group by payment to handle partial allocations
    const paymentMap = new Map();

    for (const row of paymentDetails) {
      const payId = row.id;

      if (!paymentMap.has(payId)) {
        paymentMap.set(payId, {
          id: payId,
          payment_date: row.payment_date,
          payment_method: row.payment_method,
          reference_number: row.reference_number,
          total_amount: Number(row.total_payment_amount || 0),
          allocations: [],
        });
      }

      if (row.invoice_id && row.amount_applied) {
        paymentMap.get(payId).allocations.push({
          invoice_description: row.invoice_description,
          amount_applied: Number(row.amount_applied || 0),
        });
      }
    }

    // Convert to ledger rows
    const paymentRows = [];

    for (const payment of paymentMap.values()) {
      const ref = payment.reference_number
        ? ` (${payment.reference_number})`
        : "";

      let desc;
      if (payment.allocations.length === 1) {
        desc = `Payment - ${payment.payment_method}${ref} - ${payment.allocations[0].invoice_description}`;
      } else if (payment.allocations.length > 1) {
        desc = `Payment - ${payment.payment_method}${ref} - Multiple invoices`;
      } else {
        desc = `Payment - ${payment.payment_method}${ref} - Payment on Account`;
      }

      paymentRows.push({
        kind: "credit",
        date: toDateStr(payment.payment_date),
        description: desc,
        debit: 0,
        credit: payment.total_amount,
        reference_number: payment.reference_number || null,
      });
    }

    const dedWhere = [`tenant_id = $1`, `COALESCE(approval_status, 'approved') = 'approved'`];
    const dedValues = [tenantId];

    if (from) {
      dedWhere.push(`deduction_date >= $${dedValues.length + 1}::date`);
      dedValues.push(from);
    }

    if (to) {
      dedWhere.push(`deduction_date <= $${dedValues.length + 1}::date`);
      dedValues.push(to);
    }

    const dedQuery = `
      SELECT id, deduction_date, description, amount
      FROM tenant_deductions
      WHERE ${dedWhere.join(" AND ")}
      ORDER BY deduction_date ASC, id ASC
    `;

    const deductions = await sql(dedQuery, dedValues);

    const deductionRows = deductions.map((d) => ({
      kind: "debit",
      date: toDateStr(d.deduction_date),
      description: `Tenant deduction - ${d.description}`,
      debit: Number(d.amount || 0),
      credit: 0,
    }));

    const all = [...invoiceRows, ...paymentRows, ...deductionRows];

    all.sort((a, b) => {
      const ad = String(a.date);
      const bd = String(b.date);
      if (ad < bd) return -1;
      if (ad > bd) return 1;
      // debits first for tenant (invoice first, then payment)
      if (a.debit > 0 && b.debit === 0) return -1;
      if (a.debit === 0 && b.debit > 0) return 1;
      return 0;
    });

    let balance = openingBalance;
    const rows = all.map((r) => {
      balance = balance + Number(r.debit || 0) - Number(r.credit || 0);
      return { ...r, balance };
    });

    // NEW: Calculate cumulative closing balance up to 'to' date (or all time)
    // This ensures the balance remains constant regardless of the selected 'from' date
    const closingTo = to ? to : "9999-12-31";

    const closingInvoiceRows = await sql`
      SELECT COALESCE(SUM(CASE WHEN status = 'void' THEN COALESCE(paid_amount, 0) ELSE amount END), 0) AS total
      FROM invoices
      WHERE tenant_id = ${tenantId}
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND invoice_date <= ${closingTo}::date
    `;

    const closingPaymentRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE tenant_id = ${tenantId}
        AND is_reversed = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND payment_date <= ${closingTo}::date
    `;

    const closingDedRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM tenant_deductions
      WHERE tenant_id = ${tenantId}
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(approval_status, 'approved') = 'approved'
        AND deduction_date <= ${closingTo}::date
    `;

    const closingDebits =
      Number(closingInvoiceRows?.[0]?.total || 0) +
      Number(closingDedRows?.[0]?.total || 0);
    const closingCredits = Number(closingPaymentRows?.[0]?.total || 0);

    const closingBalance = closingDebits - closingCredits;

    return Response.json({
      tenant,
      unit_number: unitNumber,
      property_name: propertyName,
      filters: { from: from || null, to: to || null },
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      rows,
    });
  } catch (error) {
    console.error("GET /api/reports/tenant-ledger error", error);
    return Response.json(
      { error: "Failed to build tenant ledger" },
      { status: 500 },
    );
  }
}
