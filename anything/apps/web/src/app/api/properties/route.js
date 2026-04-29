import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";

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

export async function GET(request) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
    }

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim();
    const limitRaw = parseInt(url.searchParams.get("limit") || "50", 10);
    const offsetRaw = parseInt(url.searchParams.get("offset") || "0", 10);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const where = [];
    const values = [];

    if (search.length > 0) {
      values.push(`%${search.toLowerCase()}%`);
      where.push(
        `(LOWER(property_name) LIKE $${values.length} OR LOWER(address) LIKE $${values.length})`,
      );
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    values.push(limit);
    const limitPos = values.length;
    values.push(offset);
    const offsetPos = values.length;

    const query = `
      SELECT id, property_name, address, property_type, total_units,
             management_fee_type, management_fee_percent, management_fee_fixed_amount,
             notes, landlord_id, created_by, created_at
      FROM properties
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${limitPos}
      OFFSET $${offsetPos}
    `;

    const properties = await sql(query, values);

    return Response.json({ properties, limit, offset });
  } catch (error) {
    console.error("GET /api/properties error", error);
    return Response.json(
      { error: "Failed to fetch properties" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, "properties");
    if (!perm.ok) {
      return Response.json(perm.body, { status: perm.status });
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

    // Validate required fields
    if (!property_name || !property_name.trim()) {
      return Response.json(
        { error: "Property name is required" },
        { status: 400 },
      );
    }

    if (!landlord_id) {
      return Response.json({ error: "Landlord is required" }, { status: 400 });
    }

    if (!property_type || !property_type.trim()) {
      return Response.json(
        { error: "Property type is required" },
        { status: 400 },
      );
    }

    // Convert landlord_id to number properly
    let landlordId = null;
    if (
      landlord_id !== null &&
      landlord_id !== undefined &&
      landlord_id !== ""
    ) {
      const parsed = Number(landlord_id);
      if (Number.isFinite(parsed)) {
        landlordId = parsed;
      } else {
        return Response.json({ error: "Invalid landlord ID" }, { status: 400 });
      }
    }

    const feeType = normalizeFeeType(management_fee_type);
    const feePercent = toNumber(management_fee_percent);
    const feeFixed = toNumber(management_fee_fixed_amount);

    if (feeType === "percent") {
      if (feePercent === null) {
        return Response.json(
          { error: "Management fee percentage is required" },
          { status: 400 },
        );
      }
      if (feePercent < 0 || feePercent > 100) {
        return Response.json(
          { error: "Management fee percent must be between 0 and 100" },
          { status: 400 },
        );
      }
    }

    if (feeType === "fixed") {
      if (feeFixed === null || feeFixed < 0) {
        return Response.json(
          {
            error:
              "Management fee fixed amount (UGX) is required and must be greater than 0",
          },
          { status: 400 },
        );
      }
    }

    const approval = getApprovalFields(perm.staff);
    const created = await sql`
      INSERT INTO properties (
        property_name, address, property_type,
        management_fee_type, management_fee_percent, management_fee_fixed_amount,
        notes,
        landlord_id,
        created_by,
        approval_status, approved_by, approved_at
      ) VALUES (
        ${property_name.trim()},
        ${address && typeof address === "string" ? address.trim() : null},
        ${property_type.trim()},
        ${feeType},
        ${feeType === "percent" ? feePercent : null},
        ${feeType === "fixed" ? feeFixed : null},
        ${typeof notes === "string" && notes.trim() ? notes.trim() : null},
        ${landlordId},
        ${perm.staff.id},
        ${approval.approval_status}, ${approval.approved_by}, ${approval.approved_at}
      )
      RETURNING *
    `;

    const property = created?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "properties.create",
      entityType: "properties",
      entityId: property?.id || null,
      oldValues: null,
      newValues: property,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ property });
  } catch (error) {
    console.error("POST /api/properties error", error);

    // Return more specific error messages
    let errorMessage = "Failed to create property";

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
