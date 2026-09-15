import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

/**
 * Manager Arrears Report
 *
 * Arrears rolled up Portfolio Manager -> Property -> Tenant, as of the
 * end of a chosen month.
 *
 * Reuses the arrears definition from /api/reports/arrears verbatim:
 *   outstanding = amount - paid_amount   (must be > 0)
 *   included only when:
 *     status <> 'void'
 *     COALESCE(is_deleted,  false) = false
 *     COALESCE(approval_status, 'approved') = 'approved'
 *     lease.status = 'active'
 *     invoice_year*100 + invoice_month < (asOf year*100 + month)
 *
 * Query params:
 *   month     1-12 (defaults to current month)
 *   year      >= 2000 (defaults to current year)
 *   officerId numeric portfolio-manager id, or the literal "unassigned",
 *             or omitted = all managers
 */
export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    let month = Number(searchParams.get("month"));
    let year = Number(searchParams.get("year"));
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      month = now.getMonth() + 1;
    }
    if (!Number.isFinite(year) || year < 2000) {
      year = now.getFullYear();
    }

    const officerIdRaw = (searchParams.get("officerId") || "").trim();
    const officerId =
      officerIdRaw === "unassigned"
        ? "unassigned"
        : officerIdRaw
          ? Number(officerIdRaw)
          : null;

    const asOfYM = year * 100 + month;
    const daysInMonth = new Date(year, month, 0).getDate();
    const asOfDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const values = [asOfYM, asOfDate];
    let officerCondition = "";
    if (officerId === "unassigned") {
      officerCondition = "AND p.assigned_officer_id IS NULL";
    } else if (officerId) {
      values.push(officerId);
      officerCondition = `AND p.assigned_officer_id = $${values.length}`;
    }

    const query = `
      WITH unpaid AS (
        SELECT
          i.lease_id,
          i.tenant_id,
          i.property_id,
          i.unit_id,
          i.due_date,
          (i.amount - i.paid_amount) AS outstanding
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.invoice_year * 100 + i.invoice_month < $1
          AND EXISTS (
            SELECT 1 FROM leases l
            WHERE l.id = i.lease_id
              AND l.status = 'active'
          )
      )
      SELECT
        u.lease_id,
        t.id AS tenant_id,
        t.full_name AS tenant_name,
        p.id AS property_id,
        p.property_name,
        p.assigned_officer_id,
        so.full_name AS officer_name,
        un.unit_number,
        COUNT(*)::int AS months_behind,
        COALESCE(SUM(u.outstanding), 0) AS arrears_amount,
        ($2::date - MIN(u.due_date))::int AS days_overdue
      FROM unpaid u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN properties p ON p.id = u.property_id
      LEFT JOIN staff_users so ON so.id = p.assigned_officer_id
      LEFT JOIN units un ON un.id = u.unit_id
      WHERE 1=1 ${officerCondition}
      GROUP BY
        u.lease_id, t.id, t.full_name,
        p.id, p.property_name, p.assigned_officer_id,
        so.full_name, un.unit_number
      ORDER BY
        so.full_name ASC NULLS LAST,
        p.property_name ASC NULLS LAST,
        (CASE WHEN un.unit_number ~ '^\\d+$' THEN un.unit_number::integer ELSE 999999 END),
        un.unit_number
      LIMIT 5000
    `;

    const rows = await sql(query, values);

    const managerMap = new Map();
    let grandTotalArrears = 0;
    let grandTotalTenants = 0;

    for (const r of rows) {
      const officerIdVal =
        r.assigned_officer_id === null || r.assigned_officer_id === undefined
          ? null
          : Number(r.assigned_officer_id);
      const officerKey = officerIdVal === null ? "unassigned" : String(officerIdVal);
      const officerName = r.officer_name || "Unassigned";
      const propertyIdVal =
        r.property_id === null || r.property_id === undefined
          ? null
          : Number(r.property_id);
      const propertyKey = propertyIdVal === null ? "none" : String(propertyIdVal);

      const days = Number(r.days_overdue || 0);
      let bucket = "0";
      if (days >= 90) bucket = "90+";
      else if (days >= 60) bucket = "60";
      else if (days >= 30) bucket = "30";

      const arrears = Number(r.arrears_amount || 0);

      let manager = managerMap.get(officerKey);
      if (!manager) {
        manager = {
          officer_id: officerIdVal,
          officer_name: officerName,
          total_arrears: 0,
          total_tenants_count: 0,
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
          subtotal_arrears: 0,
          subtotal_tenants_count: 0,
          tenants: [],
        };
        manager.properties.push(property);
        manager._propertyIndex.set(propertyKey, property);
      }

      property.tenants.push({
        lease_id: r.lease_id,
        tenant_id: r.tenant_id,
        tenant_name: r.tenant_name,
        unit_number: r.unit_number,
        arrears_amount: arrears,
        months_behind: Number(r.months_behind || 0),
        days_overdue: days,
        bucket,
      });
      property.subtotal_arrears += arrears;
      property.subtotal_tenants_count += 1;
      manager.total_arrears += arrears;
      manager.total_tenants_count += 1;
      grandTotalArrears += arrears;
      grandTotalTenants += 1;
    }

    const managers = Array.from(managerMap.values()).map((m) => {
      const { _propertyIndex, ...rest } = m;
      return rest;
    });

    return Response.json({
      as_of: { month, year, as_of_date: asOfDate },
      managers,
      grand_total_arrears: grandTotalArrears,
      grand_total_tenants_count: grandTotalTenants,
    });
  } catch (error) {
    console.error("GET /api/reports/manager-arrears error", error);
    return Response.json(
      { error: "Failed to build manager arrears report" },
      { status: 500 },
    );
  }
}
