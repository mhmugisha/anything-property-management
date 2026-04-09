import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

export async function GET(request, { params: { id } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const unitId = parseInt(id, 10);
    if (!Number.isFinite(unitId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await sql`
      SELECT * FROM units WHERE id = ${unitId} LIMIT 1
    `;
    const unit = rows?.[0] || null;
    if (!unit) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ unit });
  } catch (error) {
    console.error("GET /api/units/[id] error", error);
    return Response.json({ error: "Failed to fetch unit" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const unitId = parseInt(id, 10);
    if (!Number.isFinite(unitId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows = await sql`
      SELECT * FROM units WHERE id = ${unitId} LIMIT 1
    `;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
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

    const setClauses = [];
    const values = [];

    const pushSet = (sqlPart, value) => {
      values.push(value);
      setClauses.push(`${sqlPart} = $${values.length}`);
    };

    // Helper: accept number, numeric string, or null
    const parseNumericField = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "number") return Number.isFinite(val) ? val : null;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    if (unit_number !== undefined) {
      const unitNumStr = unit_number === null ? "" : String(unit_number).trim();
      if (unitNumStr !== "") {
        pushSet("unit_number", unitNumStr);
      }
    }

    if (bedrooms !== undefined)
      pushSet("bedrooms", parseNumericField(bedrooms));
    if (bathrooms !== undefined)
      pushSet("bathrooms", parseNumericField(bathrooms));
    if (square_feet !== undefined)
      pushSet("square_feet", parseNumericField(square_feet));
    if (monthly_rent_ugx !== undefined)
      pushSet("monthly_rent_ugx", parseNumericField(monthly_rent_ugx));
    if (deposit_amount !== undefined)
      pushSet("deposit_amount", parseNumericField(deposit_amount));
    if (status !== undefined && typeof status === "string")
      pushSet("status", status);
    if (photos !== undefined && Array.isArray(photos))
      pushSet("photos", photos);

    if (setClauses.length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    values.push(unitId);
    const query = `UPDATE units SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`;
    const updatedRows = await sql(query, values);
    const unit = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "units.update",
      entityType: "units",
      entityId: unitId,
      oldValues: existing,
      newValues: unit,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ unit });
  } catch (error) {
    console.error("PUT /api/units/[id] error", error);
    return Response.json({ error: "Failed to update unit" }, { status: 500 });
  }
}

export async function DELETE(request, { params: { id } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const unitId = parseInt(id, 10);
    if (!Number.isFinite(unitId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows = await sql`
      SELECT * FROM units WHERE id = ${unitId} LIMIT 1
    `;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const propertyId = existing.property_id;

    // Check if unit has any active leases
    const activeLeases = await sql`
      SELECT id FROM leases 
      WHERE unit_id = ${unitId} AND status = 'active'
      LIMIT 1
    `;

    if (activeLeases.length > 0) {
      return Response.json(
        { error: "Cannot delete unit with active lease" },
        { status: 400 },
      );
    }

    // Delete the unit
    await sql`DELETE FROM units WHERE id = ${unitId}`;

    // Update property total_units count
    if (propertyId) {
      await sql`
        UPDATE properties
        SET total_units = (
          SELECT COUNT(*) FROM units WHERE property_id = ${propertyId}
        )
        WHERE id = ${propertyId}
      `;
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "units.delete",
      entityType: "units",
      entityId: unitId,
      oldValues: existing,
      newValues: null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/units/[id] error", error);
    return Response.json({ error: "Failed to delete unit" }, { status: 500 });
  }
}
