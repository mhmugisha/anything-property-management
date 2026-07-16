import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

/**
 * Monthly Payment Status Report
 *
 * READ-ONLY: This endpoint only reads from invoices, payments,
 * tenant_deductions, and related lookup tables. It does NOT create,
 * update, or delete any data anywhere.
 *
 * Architecture (statement-based):
 *   arrears           = tenant-statement closing balance as of the last
 *                       day of the previous month
 *                     = SUM(invoice amounts before selected month)
 *                       - SUM(payments before selected month)
 *                       + SUM(tenant deductions before selected month)
 *   current_month_rent = SUM(invoice amounts for the selected month)
 *   total              = arrears + current_month_rent
 *   paid               = SUM(payments received within the selected month)
 *   balance            = total - paid  (may be negative)
 *
 * Query-string parameters
 *   month  (required) – 1-12
 *   year   (required) – e.g. 2025
 *   landlordId  (optional) – filter by landlord
 *   propertyId  (optional) – filter by property
 *   officerId   (optional) – filter by portfolio manager id, or the
 *                            literal "unassigned" for properties with
 *                            no assigned officer
 */
export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);

    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (
      !Number.isFinite(month) ||
      !Number.isFinite(year) ||
      month < 1 ||
      month > 12 ||
      year < 2000
    ) {
      return Response.json(
        { error: "Valid month (1-12) and year are required." },
        { status: 400 },
      );
    }

    const landlordIdRaw = (searchParams.get("landlordId") || "").trim();
    const propertyIdRaw = (searchParams.get("propertyId") || "").trim();
    const officerIdRaw = (searchParams.get("officerId") || "").trim();

    const landlordId = landlordIdRaw ? Number(landlordIdRaw) : null;
    const propertyId = propertyIdRaw ? Number(propertyIdRaw) : null;
    const officerId =
      officerIdRaw === "unassigned"
        ? "unassigned"
        : officerIdRaw
          ? Number(officerIdRaw)
          : null;

    // ----------------------------------------------------------------
    // Build dynamic WHERE conditions for the base lease set
    // ----------------------------------------------------------------
    let paramIdx = 1;
    const conditions = [];
    const values = [];

    conditions.push(`l.status = 'active'`);

    if (landlordId) {
      conditions.push(`p.landlord_id = $${paramIdx++}`);
      values.push(landlordId);
    }

    if (propertyId) {
      conditions.push(`p.id = $${paramIdx++}`);
      values.push(propertyId);
    }

    if (officerId === "unassigned") {
      conditions.push(`p.assigned_officer_id IS NULL`);
    } else if (officerId) {
      conditions.push(`p.assigned_officer_id = $${paramIdx++}`);
      values.push(officerId);
    }

    const whereClause = conditions.length
      ? "WHERE " + conditions.join(" AND ")
      : "";

    // ----------------------------------------------------------------
    // 1. Get all units (both occupied and vacant) with their lease/tenant info
    //    scoped by optional landlord / property filters.
    // ----------------------------------------------------------------
    const unitsQuery = `
      SELECT
        u.id        AS unit_id,
        u.unit_number,
        u.property_id,
        p.property_name,
        p.landlord_id,
        la.full_name AS landlord_name,
        l.id        AS lease_id,
        l.tenant_id,
        l.monthly_rent AS lease_monthly_rent,
        t.full_name AS tenant_name,
        t.phone AS tenant_phone,
        COALESCE(u.monthly_rent_ugx, 0) AS unit_monthly_rent,
        CASE
          WHEN l.id IS NOT NULL THEN 'Occupied'
          ELSE 'Vacant'
        END AS status
      FROM units u
      JOIN properties p ON p.id = u.property_id
      LEFT JOIN landlords la ON la.id = p.landlord_id
      LEFT JOIN leases l ON l.unit_id = u.id AND l.status = 'active'
      LEFT JOIN tenants t ON t.id = l.tenant_id
      ${whereClause.replace("l.status = 'active'", "1=1")}
      ORDER BY
        p.property_name,
        (CASE WHEN u.unit_number ~ '^\d+$' THEN u.unit_number::integer ELSE 999999 END),
        u.unit_number
    `;

    const units = await sql(unitsQuery, values);

    if (units.length === 0) {
      return Response.json({ rows: [], month, year });
    }

    const leaseIds = units
      .filter((u) => u.lease_id !== null)
      .map((u) => u.lease_id);

    const tenantIds = units
      .filter((u) => u.tenant_id !== null)
      .map((u) => u.tenant_id);

    // Map tenant → active lease for this report scope, so per-tenant
    // opening-balance sums can be attributed to a lease row.
    const tenantToLease = new Map();
    for (const u of units) {
      if (u.tenant_id && u.lease_id) tenantToLease.set(u.tenant_id, u.lease_id);
    }

    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const lastDayExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    // ----------------------------------------------------------------
    // 2. Current-month invoices  (invoice_month = month, invoice_year = year)
    // ----------------------------------------------------------------
    let currentMap = {};
    if (leaseIds.length > 0 && tenantIds.length > 0) {
      const currentMonthInvoices = await sql(
        `SELECT
           COALESCE(i.lease_id, l.id) AS lease_id,
           COALESCE(SUM(i.amount), 0) AS invoiced
         FROM invoices i
         LEFT JOIN leases l ON l.tenant_id = i.tenant_id
           AND l.id = ANY($1)
         WHERE (
           i.lease_id = ANY($1)
           OR (i.lease_id IS NULL AND i.tenant_id = ANY($2))
         )
           AND invoice_month = $3
           AND invoice_year = $4
           AND COALESCE(i.is_deleted, false) = false
           AND COALESCE(i.approval_status, 'approved') = 'approved'
           AND COALESCE(i.status, '') <> 'void'
         GROUP BY COALESCE(i.lease_id, l.id)`,
        [leaseIds, tenantIds, month, year],
      );

      for (const row of currentMonthInvoices) {
        if (row.lease_id) {
          currentMap[row.lease_id] = Number(row.invoiced);
        }
      }
    }

    // ----------------------------------------------------------------
    // 3. Arrears = tenant-statement closing balance as of the last day
    //    of the previous month.
    //      arrears = SUM(invoices before firstDay)
    //              - SUM(payment allocations before firstDay)
    //              + SUM(tenant deductions before firstDay)
    //    Computed per tenant, then attributed to the active lease.
    // ----------------------------------------------------------------
    let arrearsMap = {};
    if (tenantIds.length > 0) {
      const [obInvoices, obPayments, obDeductions] = await Promise.all([
        sql(
          `SELECT tenant_id, COALESCE(SUM(amount), 0) AS total
           FROM invoices
           WHERE tenant_id = ANY($1)
             AND COALESCE(is_deleted, false) = false
             AND COALESCE(approval_status, 'approved') = 'approved'
             AND COALESCE(status, '') <> 'void'
             AND invoice_date < $2::date
           GROUP BY tenant_id`,
          [tenantIds, firstDay],
        ),
        sql(
          `SELECT p.tenant_id, COALESCE(SUM(pia.amount_applied), 0) AS total
           FROM payments p
           JOIN payment_invoice_allocations pia ON pia.payment_id = p.id
           WHERE p.tenant_id = ANY($1)
             AND p.is_reversed = false
             AND COALESCE(p.approval_status, 'approved') = 'approved'
             AND p.payment_date < $2::date
           GROUP BY p.tenant_id`,
          [tenantIds, firstDay],
        ),
        sql(
          `SELECT tenant_id, COALESCE(SUM(amount), 0) AS total
           FROM tenant_deductions
           WHERE tenant_id = ANY($1)
             AND COALESCE(is_deleted, false) = false
             AND COALESCE(approval_status, 'approved') = 'approved'
             AND deduction_date < $2::date
           GROUP BY tenant_id`,
          [tenantIds, firstDay],
        ),
      ]);

      const perTenant = new Map();
      const bucket = (tid) => {
        let b = perTenant.get(tid);
        if (!b) {
          b = { inv: 0, pay: 0, ded: 0 };
          perTenant.set(tid, b);
        }
        return b;
      };
      for (const r of obInvoices) bucket(r.tenant_id).inv = Number(r.total);
      for (const r of obPayments) bucket(r.tenant_id).pay = Number(r.total);
      for (const r of obDeductions) bucket(r.tenant_id).ded = Number(r.total);

      for (const [tid, { inv, pay, ded }] of perTenant.entries()) {
        const leaseId = tenantToLease.get(tid);
        if (leaseId) arrearsMap[leaseId] = inv - pay + ded;
      }
    }

    // ----------------------------------------------------------------
    // 4. Payments received during the selected month
    //    All payments per lease_id, regardless of allocation to invoices.
    // ----------------------------------------------------------------
    let paymentsMap = {};
    if (leaseIds.length > 0) {
      const paymentsRows = await sql(
        `SELECT
           lease_id,
           COALESCE(SUM(amount), 0) AS total_paid
         FROM payments
         WHERE lease_id = ANY($1)
           AND is_reversed = false
           AND COALESCE(approval_status, 'approved') = 'approved'
           AND payment_date >= $2::date
           AND payment_date <  $3::date
         GROUP BY lease_id`,
        [leaseIds, firstDay, lastDayExclusive],
      );

      for (const row of paymentsRows) {
        paymentsMap[row.lease_id] = Number(row.total_paid);
      }
    }

    // ----------------------------------------------------------------
    // 5. Assemble rows
    // ----------------------------------------------------------------
    const rows = units.map((u) => {
      const isOccupied = u.status === "Occupied";
      const arrears = isOccupied ? arrearsMap[u.lease_id] || 0 : 0;
      const currentMonthRent = isOccupied ? currentMap[u.lease_id] || 0 : 0;
      const total = arrears + currentMonthRent;
      const paid = isOccupied ? paymentsMap[u.lease_id] || 0 : 0;
      const balance = total - paid;

      const rent = isOccupied
        ? Number(u.lease_monthly_rent || 0)
        : Number(u.unit_monthly_rent || 0);

      return {
        lease_id: u.lease_id,
        tenant_id: u.tenant_id,
        tenant_name: u.tenant_name || "—",
        tenant_phone: u.tenant_phone || "—",
        unit_id: u.unit_id,
        unit_number: u.unit_number,
        property_id: u.property_id,
        property_name: u.property_name,
        landlord_id: u.landlord_id,
        landlord_name: u.landlord_name,
        status: u.status,
        rent,
        arrears,
        current_month_rent: currentMonthRent,
        total,
        paid,
        balance,
      };
    });

    return Response.json({ rows, month, year });
  } catch (error) {
    console.error("GET /api/reports/payment-status error:", error);
    return Response.json(
      { error: "Failed to load payment status report." },
      { status: 500 },
    );
  }
}
