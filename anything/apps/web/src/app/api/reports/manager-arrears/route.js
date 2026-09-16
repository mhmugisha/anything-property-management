import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { isManagerScoped } from "@/app/api/utils/managerScope";

/**
 * Manager Arrears Report
 *
 * Unpaid invoices grouped Portfolio Manager -> Property -> Invoice row.
 *
 * Reuses the arrears definition from /api/reports/arrears and
 * /api/payments/open-balances verbatim:
 *   (amount - paid_amount) > 0
 *   status <> 'void'
 *   COALESCE(is_deleted, false) = false
 *   COALESCE(approval_status, 'approved') = 'approved'
 *   Lease is active
 *
 * Returns ONE ROW PER UNPAID INVOICE (not aggregated per lease).
 *
 * From/To dates filter on i.invoice_date, matching Open Balances.
 *
 * Query params:
 *   fromDate   YYYY-MM-DD (optional)
 *   toDate     YYYY-MM-DD (optional)
 *   officerId  numeric portfolio-manager id, "unassigned", or omitted = all
 */
export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = (searchParams.get("fromDate") || "").trim() || null;
    const toDate = (searchParams.get("toDate") || "").trim() || null;

    const officerIdRaw = (searchParams.get("officerId") || "").trim();
    let officerId =
      officerIdRaw === "unassigned"
        ? "unassigned"
        : officerIdRaw
          ? Number(officerIdRaw)
          : null;

    // Manager scoping: a Portfolio Manager can only ever see their own
    // portfolio. Any ?officerId= (including "unassigned" or another
    // manager's id) is overridden with the caller's own staff id.
    // Admins keep the existing behavior.
    if (isManagerScoped(perm.staff)) {
      officerId = Number(perm.staff.id);
    }

    const conditions = [
      "(i.amount - i.paid_amount) > 0",
      "i.status <> 'void'",
      "COALESCE(i.is_deleted, false) = false",
      "COALESCE(i.approval_status, 'approved') = 'approved'",
      "EXISTS (SELECT 1 FROM leases l WHERE l.id = i.lease_id AND l.status = 'active')",
    ];
    const values = [];

    if (fromDate) {
      values.push(fromDate);
      conditions.push(`i.invoice_date >= $${values.length}`);
    }
    if (toDate) {
      values.push(toDate);
      conditions.push(`i.invoice_date <= $${values.length}`);
    }
    if (officerId === "unassigned") {
      conditions.push("p.assigned_officer_id IS NULL");
    } else if (officerId) {
      values.push(officerId);
      conditions.push(`p.assigned_officer_id = $${values.length}`);
    }

    const query = `
      SELECT
        i.id AS invoice_id,
        i.lease_id,
        i.tenant_id,
        i.unit_id,
        i.property_id,
        i.invoice_date,
        i.due_date,
        i.amount,
        i.paid_amount,
        (i.amount - i.paid_amount) AS balance,
        (CURRENT_DATE - i.due_date)::int AS days_overdue,
        t.full_name AS tenant_name,
        un.unit_number,
        p.property_name,
        p.assigned_officer_id,
        so.full_name AS officer_name
      FROM invoices i
      LEFT JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN units un ON un.id = i.unit_id
      LEFT JOIN properties p ON p.id = i.property_id
      LEFT JOIN staff_users so ON so.id = p.assigned_officer_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        so.full_name ASC NULLS LAST,
        p.property_name ASC NULLS LAST,
        (CASE WHEN un.unit_number ~ '^\\d+$' THEN un.unit_number::integer ELSE 999999 END),
        un.unit_number,
        i.due_date ASC NULLS LAST
      LIMIT 10000
    `;

    const rows = await sql(query, values);

    const managerMap = new Map();
    let grandTotalBalance = 0;
    let totalRent = 0;
    let recovered = 0;

    for (const r of rows) {
      const officerIdVal =
        r.assigned_officer_id === null || r.assigned_officer_id === undefined
          ? null
          : Number(r.assigned_officer_id);
      const officerKey =
        officerIdVal === null ? "unassigned" : String(officerIdVal);
      const officerName = r.officer_name || "Unassigned";

      const propertyIdVal =
        r.property_id === null || r.property_id === undefined
          ? null
          : Number(r.property_id);
      const propertyKey = propertyIdVal === null ? "none" : String(propertyIdVal);

      const amount = Number(r.amount || 0);
      const paidAmount = Number(r.paid_amount || 0);
      const balance = Number(r.balance || 0);
      const daysOverdue = Number(r.days_overdue || 0);

      let manager = managerMap.get(officerKey);
      if (!manager) {
        manager = {
          officer_id: officerIdVal,
          officer_name: officerName,
          total_balance: 0,
          properties: [],
          _propertyIndex: new Map(),
        };
        managerMap.set(officerKey, manager);
      }

      let property = manager._propertyIndex.get(propertyKey);
      if (!property) {
        property = {
          property_id: propertyIdVal,
          property_name: r.property_name || "—",
          subtotal_balance: 0,
          rows: [],
        };
        manager.properties.push(property);
        manager._propertyIndex.set(propertyKey, property);
      }

      property.rows.push({
        invoice_id: r.invoice_id,
        lease_id: r.lease_id,
        tenant_id: r.tenant_id,
        unit_number: r.unit_number || "—",
        tenant_name: r.tenant_name || "—",
        due_date: r.due_date,
        invoice_date: r.invoice_date,
        amount,
        paid_amount: paidAmount,
        days_overdue: daysOverdue,
        balance,
      });
      property.subtotal_balance += balance;
      manager.total_balance += balance;
      grandTotalBalance += balance;
      totalRent += amount;
      recovered += amount - balance;
    }

    const managers = Array.from(managerMap.values()).map((m) => {
      const { _propertyIndex, ...rest } = m;
      return rest;
    });

    const recoveryRate = totalRent > 0 ? (recovered / totalRent) * 100 : 0;

    return Response.json({
      from: fromDate,
      to: toDate,
      managers,
      grand_total_balance: grandTotalBalance,
      summary: {
        total_rent: totalRent,
        recovered,
        balance: grandTotalBalance,
        recovery_rate: recoveryRate,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/manager-arrears error", error);
    return Response.json(
      { error: "Failed to build manager arrears report" },
      { status: 500 },
    );
  }
}
