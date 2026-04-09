import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeFeeType(value) {
  const v = String(value || "percent")
    .trim()
    .toLowerCase();
  if (v === "fixed") return "fixed";
  return "percent";
}

export async function GET(request, { params: { id } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const propertyId = parseInt(id, 10);
    if (!Number.isFinite(propertyId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, property_name, address, property_type, total_units,
             management_fee_type, management_fee_percent, management_fee_fixed_amount,
             notes, landlord_id, created_by, created_at
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `;

    const property = rows?.[0] || null;
    if (!property) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ property });
  } catch (error) {
    console.error("GET /api/properties/[id] error", error);
    return Response.json(
      { error: "Failed to fetch property" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params: { id } }) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const propertyId = parseInt(id, 10);
    if (!Number.isFinite(propertyId)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows = await sql`
      SELECT id, property_name, address, property_type, total_units,
             management_fee_type, management_fee_percent, management_fee_fixed_amount,
             notes, landlord_id
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      property_name,
      address,
      property_type,
      management_fee_type,
      management_fee_percent,
      management_fee_fixed_amount,
      notes,
      landlord_id,
    } = body || {};

    const setClauses = [];
    const values = [];

    const pushSet = (sqlPart, value) => {
      values.push(value);
      setClauses.push(`${sqlPart} = $${values.length}`);
    };

    if (typeof property_name === "string")
      pushSet("property_name", property_name.trim());
    if (typeof address === "string") pushSet("address", address.trim());
    if (typeof property_type === "string")
      pushSet("property_type", property_type.trim());

    // Fee updates (if provided)
    const hasFeeType = typeof management_fee_type === "string";
    const hasFeePercent = management_fee_percent !== undefined;
    const hasFeeFixed = management_fee_fixed_amount !== undefined;
    const feeChanged = hasFeeType || hasFeePercent || hasFeeFixed;

    if (hasFeeType || hasFeePercent || hasFeeFixed) {
      const nextType = hasFeeType
        ? normalizeFeeType(management_fee_type)
        : existing.management_fee_type || "percent";

      const nextPercent = toNumber(
        hasFeePercent
          ? management_fee_percent
          : existing.management_fee_percent,
      );
      const nextFixed = toNumber(
        hasFeeFixed
          ? management_fee_fixed_amount
          : existing.management_fee_fixed_amount,
      );

      if (nextType === "percent") {
        if (nextPercent !== null && (nextPercent < 0 || nextPercent > 100)) {
          return Response.json(
            { error: "Management fee percent must be between 0 and 100" },
            { status: 400 },
          );
        }
        pushSet("management_fee_type", "percent");
        pushSet("management_fee_percent", nextPercent);
        pushSet("management_fee_fixed_amount", null);
      }

      if (nextType === "fixed") {
        if (nextFixed === null || nextFixed < 0) {
          return Response.json(
            { error: "Management fee fixed amount (UGX) is required" },
            { status: 400 },
          );
        }
        pushSet("management_fee_type", "fixed");
        pushSet("management_fee_percent", null);
        pushSet("management_fee_fixed_amount", nextFixed);
      }
    }

    if (typeof notes === "string") pushSet("notes", notes.trim());

    // Handle landlord_id conversion from string to number
    if (landlord_id !== undefined) {
      if (landlord_id === null || landlord_id === "") {
        pushSet("landlord_id", null);
      } else {
        const parsedLandlordId = Number(landlord_id);
        if (Number.isFinite(parsedLandlordId)) {
          pushSet("landlord_id", parsedLandlordId);
        } else {
          return Response.json(
            { error: "Invalid landlord ID" },
            { status: 400 },
          );
        }
      }
    }

    if (setClauses.length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    values.push(propertyId);
    const query = `UPDATE properties SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`;
    const updatedRows = await sql(query, values);
    const property = updatedRows?.[0] || null;

    // If management fee config changed, wipe commission fields on invoices for this property.
    // Management fees are now computed per property-month (summary) and posted to the ledger.
    if (feeChanged && property) {
      await sql`
        UPDATE invoices
        SET commission_rate = 0,
            commission_amount = 0
        WHERE property_id = ${propertyId}
          AND status <> 'void'
      `;
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "properties.update",
      entityType: "properties",
      entityId: propertyId,
      oldValues: existing,
      newValues: property,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ property });
  } catch (error) {
    console.error("PUT /api/properties/[id] error", error);

    // Return more specific error messages
    let errorMessage = "Failed to update property";

    if (error.message?.includes("foreign key")) {
      errorMessage =
        "Invalid landlord selected. Please select a valid landlord.";
    } else if (error.message?.includes("duplicate")) {
      errorMessage = "A property with this name already exists.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
