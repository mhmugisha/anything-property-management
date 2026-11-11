import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getManagerScope } from "@/app/api/utils/managerScope";
import { insertUnitWithRecalc } from "@/app/api/utils/units/createUnit";
import { submitUnit } from "@/app/api/utils/units/unitSubmissions";

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

    // Portfolio Managers may only load units of properties assigned to them.
    const scope = await getManagerScope(perm);
    if (scope.scoped && !scope.propertyIds.includes(pid)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
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
    // Admin creates units directly; anyone else with "properties" proposes
    // one into unit_submissions for Admin approval.
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }
    const isAdmin = perm.staff?.role_name === "Admin";

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
      monthly_rent_usd,
      deposit_amount,
      status,
      photos,
    } = body || {};

    if (!unit_number || typeof unit_number !== "string" || !unit_number.trim()) {
      return Response.json(
        { error: "unit_number is required" },
        { status: 400 },
      );
    }

    const values = {
      property_id: pid,
      unit_number: unit_number.trim(),
      bedrooms: Number.isFinite(bedrooms) ? bedrooms : null,
      bathrooms: Number.isFinite(bathrooms) ? bathrooms : null,
      square_feet: typeof square_feet === "number" ? square_feet : null,
      monthly_rent_ugx:
        typeof monthly_rent_ugx === "number" ? monthly_rent_ugx : null,
      monthly_rent_usd:
        typeof monthly_rent_usd === "number" ? monthly_rent_usd : null,
      deposit_amount: typeof deposit_amount === "number" ? deposit_amount : null,
      photos: Array.isArray(photos) ? photos : [],
    };

    if (!isAdmin) {
      // Same scoping as GET: Portfolio Managers only for their properties.
      const scope = await getManagerScope(perm);
      if (scope.scoped && !scope.propertyIds.includes(pid)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const result = await submitUnit({ propertyId: pid, values, perm });
      return Response.json(result.body, { status: result.status });
    }

    const created = await insertUnitWithRecalc({
      values: {
        ...values,
        status: typeof status === "string" ? status : "vacant",
      },
    });
    const unit = created?.unit || null;

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
