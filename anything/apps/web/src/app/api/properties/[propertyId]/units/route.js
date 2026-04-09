import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

export async function GET(request, { params: { propertyId } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const pid = parseInt(propertyId, 10);
    if (!Number.isFinite(pid)) {
      return Response.json({ error: "Invalid propertyId" }, { status: 400 });
    }

    // Include the current active tenant (if any) for each unit.
    const rows = await sql`
      SELECT
        u.*,
        cur.tenant_id AS current_tenant_id,
        cur.tenant_name AS current_tenant_name
      FROM units u
      LEFT JOIN LATERAL (
        SELECT
          l.tenant_id,
          t.full_name AS tenant_name
        FROM leases l
        JOIN tenants t ON t.id = l.tenant_id
        WHERE l.unit_id = u.id
          AND l.status = 'active'
        ORDER BY l.start_date DESC
        LIMIT 1
      ) cur ON true
      WHERE u.property_id = ${pid}
      ORDER BY u.id
    `;

    return Response.json({ units: rows });
  } catch (error) {
    console.error("GET /api/properties/[propertyId]/units error", error);
    return Response.json({ error: "Failed to fetch units" }, { status: 500 });
  }
}

export async function POST(request, { params: { propertyId } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const pid = parseInt(propertyId, 10);
    if (!Number.isFinite(pid)) {
      return Response.json({ error: "Invalid propertyId" }, { status: 400 });
    }

    const body = await request.json();
    const {
      unit_number,
      bedrooms,
      bathrooms,
      square_feet,
      monthly_rent_ugx,
      deposit_amount,
      status,
      photos,
    } = body || {};

    if (!unit_number || typeof unit_number !== "string") {
      return Response.json(
        { error: "unit_number is required" },
        { status: 400 },
      );
    }

    const inserted = await sql`
      INSERT INTO units (
        property_id,
        unit_number,
        bedrooms,
        bathrooms,
        square_feet,
        monthly_rent_ugx,
        deposit_amount,
        status,
        photos
      ) VALUES (
        ${pid},
        ${unit_number.trim()},
        ${Number.isFinite(bedrooms) ? bedrooms : null},
        ${Number.isFinite(bathrooms) ? bathrooms : null},
        ${typeof square_feet === "number" ? square_feet : null},
        ${typeof monthly_rent_ugx === "number" ? monthly_rent_ugx : null},
        ${typeof deposit_amount === "number" ? deposit_amount : null},
        ${typeof status === "string" ? status : "vacant"},
        ${Array.isArray(photos) ? photos : []}
      )
      RETURNING *
    `;

    const unit = inserted?.[0] || null;

    // update property total_units to keep it accurate
    await sql`
      UPDATE properties
      SET total_units = (
        SELECT COUNT(*) FROM units WHERE property_id = ${pid}
      )
      WHERE id = ${pid}
    `;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "units.create",
      entityType: "units",
      entityId: unit?.id || null,
      oldValues: null,
      newValues: unit,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ unit });
  } catch (error) {
    console.error("POST /api/properties/[propertyId]/units error", error);
    const message =
      typeof error?.message === "string"
        ? error.message
        : "Failed to create unit";
    return Response.json({ error: message }, { status: 500 });
  }
}
