import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

/**
 * Monthly Payment Status Report
 *
 * READ-ONLY: This endpoint only reads from invoices, payments, and
 * related lookup tables.  It does NOT create, update, or delete any
 * data anywhere.
 *
 * Query-string parameters
 *   month  (required) – 1-12
 *   year   (required) – e.g. 2025
 *   landlordId  (optional) – filter by landlord
 *   propertyId  (optional) – filter by property
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

    const landlordId = landlordIdRaw ? Number(landlordIdRaw) : null;
    const propertyId = propertyIdRaw ? Number(propertyIdRaw) : null;

    // ----------------------------------------------------------------
    // Build dynamic WHERE conditions for the base lease set
    // ----------------------------------------------------------------
    let paramIdx = 1;
    const conditions = [];
    const values = [];

    // Only active leases that overlap the selected month
    // Lease must have started on or before the last day of selected month
    // and must not have ended before the first day of selected month
    conditions.push(`l.status = 'active'`);

    // Landlord filter
    if (landlordId) {
      conditions.push(`p.landlord_id = $${paramIdx++}`);
      values.push(landlordId);
    }

    // Property filter
    if (propertyId) {
      conditions.push(`p.id = $${paramIdx++}`);
      values.push(propertyId);
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

    // Collect lease IDs and tenant IDs for occupied units only
    const leaseIds = units
      .filter((u) => u.lease_id !== null)
      .map((u) => u.lease_id);

    const tenantIds = units
      .filter((u) => u.tenant_id !== null)
      .map((u) => u.tenant_id);

    // ----------------------------------------------------------------
    // 2. Current-month invoices  (invoice_month = month, invoice_year = year)
    //    Only for occupied units
    // ----------------------------------------------------------------
    let currentMap = {};
    if (leaseIds.length > 0) {
      const currentMonthInvoices = await sql(
        `SELECT
           lease_id,
           COALESCE(SUM(amount), 0)       AS invoiced,
           COALESCE(SUM(paid_amount), 0)   AS paid_on_invoice
         FROM invoices
         WHERE lease_id = ANY($1)
           AND invoice_month = $2
           AND invoice_year  = $3
           AND COALESCE(approval_status, 'approved') = 'approved'
         GROUP BY lease_id`,
        [leaseIds, month, year],
      );

      for (const row of currentMonthInvoices) {
        currentMap[row.lease_id] = {
          invoiced: Number(row.invoiced),
          paidOnInvoice: Number(row.paid_on_invoice),
        };
      }
    }

    // ----------------------------------------------------------------
    // 3. Arrears – all invoices BEFORE the selected month that still
    //    have an outstanding balance  (amount - paid_amount > 0).
    //    This now includes BOTH:
    //    a) Regular invoices with lease_id before the selected month
    //    b) Arrears invoices (lease_id IS NULL) posted via Post Arrears form
    //    Only for occupied units
    // ----------------------------------------------------------------
    let arrearsMap = {};
    if (leaseIds.length > 0 && tenantIds.length > 0) {
      const arrearsRows = await sql(
        `SELECT
           COALESCE(i.lease_id, l.id) AS lease_id,
           COALESCE(SUM(i.amount - i.paid_amount), 0) AS arrears
         FROM invoices i
         LEFT JOIN leases l ON l.tenant_id = i.tenant_id AND l.id = ANY($1)
         WHERE (
           (i.lease_id = ANY($1))
           OR (i.lease_id IS NULL AND i.tenant_id = ANY($2))
         )
           AND COALESCE(i.is_deleted, false) = false
           AND COALESCE(i.approval_status, 'approved') = 'approved'
           AND (
             i.invoice_year < $3
             OR (i.invoice_year = $3 AND i.invoice_month < $4)
           )
           AND (i.amount - i.paid_amount) > 0
         GROUP BY COALESCE(i.lease_id, l.id)`,
        [leaseIds, tenantIds, year, month],
      );

      for (const row of arrearsRows) {
        if (row.lease_id) {
          arrearsMap[row.lease_id] = Number(row.arrears);
        }
      }
    }

    // ----------------------------------------------------------------
    // 4. Payments received during the selected month
    //    (payment_date falls within the calendar month).
    //    Only for occupied units
    // ----------------------------------------------------------------
    let paymentsMap = {};
    if (leaseIds.length > 0) {
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      // last day of selected month
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const lastDayExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

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
      const currentMonthRent = isOccupied
        ? currentMap[u.lease_id]?.invoiced || 0
        : 0;
      const total = arrears + currentMonthRent;
      const paid = isOccupied ? paymentsMap[u.lease_id] || 0 : 0;
      const balance = total - paid;

      // Rent is the monthly rent amount (from lease if occupied, from unit if vacant)
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
        rent: rent,
        arrears,
        current_month_rent: currentMonthRent,
        total,
        paid,
        balance: balance < 0 ? 0 : balance,
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
