import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const asOfDate =
      url.searchParams.get("asOfDate") || new Date().toISOString().slice(0, 10);

    if (!propertyId) {
      return Response.json(
        { error: "propertyId is required" },
        { status: 400 },
      );
    }

    const pid = Number(propertyId);
    if (!Number.isFinite(pid)) {
      return Response.json({ error: "Invalid propertyId" }, { status: 400 });
    }

    // Fetch property + landlord info
    const propertyRows = await sql(
      `SELECT p.id, p.property_name, p.address, p.property_type,
              l.full_name AS landlord_name, l.title AS landlord_title
       FROM properties p
       LEFT JOIN landlords l ON l.id = p.landlord_id
       WHERE p.id = $1
       LIMIT 1`,
      [pid],
    );

    const property = propertyRows[0] || null;
    if (!property) {
      return Response.json({ error: "Property not found" }, { status: 404 });
    }

    // Fetch all units for this property, along with active lease info as of the given date
    // and balance = SUM(invoices due) - SUM(payments applied) up to asOfDate
    const unitRows = await sql(
      `WITH active_leases AS (
        SELECT
          le.id AS lease_id,
          le.unit_id,
          le.tenant_id,
          le.start_date,
          le.end_date,
          le.monthly_rent,
          le.deposit_amount,
          le.deposit_paid,
          t.full_name AS tenant_name,
          t.title AS tenant_title
        FROM leases le
        LEFT JOIN tenants t ON t.id = le.tenant_id
        WHERE le.unit_id IN (SELECT id FROM units WHERE property_id = $1)
          AND le.status = 'active'
          AND le.start_date <= $2::date
          AND le.end_date >= $2::date
      ),
      unit_balances AS (
        SELECT
          i.unit_id,
          COALESCE(SUM(i.amount - i.paid_amount), 0) AS outstanding_balance
        FROM invoices i
        WHERE i.property_id = $1
          AND i.status <> 'void'
          AND i.due_date <= $2::date
        GROUP BY i.unit_id
      )
      SELECT
        u.id AS unit_id,
        u.unit_number,
        u.monthly_rent_ugx,
        u.status AS unit_status,
        al.lease_id,
        al.tenant_name,
        al.tenant_title,
        al.start_date AS lease_start,
        al.end_date AS lease_end,
        al.monthly_rent AS lease_rent,
        al.deposit_amount,
        al.deposit_paid,
        COALESCE(ub.outstanding_balance, 0) AS balance
      FROM units u
      LEFT JOIN active_leases al ON al.unit_id = u.id
      LEFT JOIN unit_balances ub ON ub.unit_id = u.id
      WHERE u.property_id = $1
      ORDER BY 
        (CASE WHEN u.unit_number ~ '^\d+$' THEN u.unit_number::integer ELSE 999999 END),
        u.unit_number`,
      [pid, asOfDate],
    );

    // Build rows
    const rows = unitRows.map((r) => {
      const hasLease = !!r.lease_id;
      const status = hasLease ? "Active" : "Vacant";
      const balance = Number(r.balance || 0);

      return {
        unit: r.unit_number || "",
        tenant_name: hasLease
          ? `${r.tenant_title ? r.tenant_title + " " : ""}${r.tenant_name || ""}`
          : "",
        lease_start: hasLease ? r.lease_start : null,
        lease_end: hasLease ? r.lease_end : null,
        monthly_rent: Number(r.lease_rent || r.monthly_rent_ugx || 0),
        deposit_held: hasLease ? Number(r.deposit_paid || 0) : null,
        balance: hasLease ? balance : null,
        status: status,
      };
    });

    // Build summary
    const totalUnits = rows.length;
    const occupiedUnits = rows.filter((r) => r.status === "Active").length;
    const vacantUnits = totalUnits - occupiedUnits;
    const occupancyRate =
      totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : "0.0";

    const totalPotentialRent = rows.reduce((sum, r) => {
      // Use the unit's monthly_rent_ugx for potential rent
      return sum;
    }, 0);

    // Re-fetch unit rents separately for potential calculation
    const allUnitRents = unitRows.reduce(
      (sum, r) => sum + Number(r.monthly_rent_ugx || r.lease_rent || 0),
      0,
    );
    const actualOccupiedRent = rows
      .filter((r) => r.status === "Occupied" || r.status === "Late")
      .reduce((sum, r) => sum + Number(r.monthly_rent || 0), 0);

    const totalBalance = rows.reduce(
      (sum, r) => sum + Number(r.balance || 0),
      0,
    );
    const totalDeposits = rows.reduce(
      (sum, r) => sum + Number(r.deposit_held || 0),
      0,
    );

    const summary = {
      total_units: totalUnits,
      occupied_units: occupiedUnits,
      vacant_units: vacantUnits,
      occupancy_rate: occupancyRate,
      total_potential_rent: allUnitRents,
      total_actual_rent: actualOccupiedRent,
      total_outstanding_balance: totalBalance,
      total_deposits_held: totalDeposits,
    };

    const landlordDisplay = property.landlord_title
      ? `${property.landlord_title} ${property.landlord_name}`
      : property.landlord_name || "";

    return Response.json({
      property: {
        id: property.id,
        property_name: property.property_name,
        address: property.address,
        landlord_name: landlordDisplay,
      },
      rows,
      summary,
      as_of_date: asOfDate,
    });
  } catch (error) {
    console.error("GET /api/reports/rent-roll error", error);
    return Response.json(
      { error: "Failed to generate rent roll" },
      { status: 500 },
    );
  }
}
