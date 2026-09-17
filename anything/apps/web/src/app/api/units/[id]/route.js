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

    // Pre-check for anything referencing this unit. Deleting a unit that has
    // leases, invoices, or maintenance history would either break ledger
    // integrity or fail with a Postgres FK error the client can't decode.
    // We block with a 409 that names what's in the way.
    const blockerRows = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM leases WHERE unit_id = ${unitId}) AS leases,
        (SELECT COUNT(*)::int FROM invoices WHERE unit_id = ${unitId}) AS invoices,
        (SELECT COUNT(*)::int FROM maintenance_requests WHERE unit_id = ${unitId}) AS maintenance
    `;
    const blockers = blockerRows?.[0] || {
      leases: 0,
      invoices: 0,
      maintenance: 0,
    };
    const parts = [];
    if (Number(blockers.leases) > 0) parts.push("leases");
    if (Number(blockers.invoices) > 0) parts.push("invoices");
    if (Number(blockers.maintenance) > 0) parts.push("maintenance history");

    if (parts.length > 0) {
      const list =
        parts.length === 1
          ? parts[0]
          : parts.length === 2
            ? `${parts[0]} and ${parts[1]}`
            : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
      return Response.json(
        {
          error: `This unit has ${list} tied to it and can't be deleted.`,
          code: "has_history",
        },
        { status: 409 },
      );
    }

    // Genuinely unused — safe to hard-delete. If some other FK we didn't
    // pre-check blocks it, translate Postgres 23503 into the same 409 shape.
    try {
      await sql`DELETE FROM units WHERE id = ${unitId}`;
    } catch (dbError) {
      if (dbError?.code === "23503") {
        console.warn(
          `units delete blocked by unknown FK for id=${unitId}`,
          dbError,
        );
        return Response.json(
          {
            error:
              "This unit is referenced by other records and can't be deleted.",
            code: "has_history",
          },
          { status: 409 },
        );
      }
      throw dbError;
    }

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
