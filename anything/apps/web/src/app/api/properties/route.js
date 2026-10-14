import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";
import { getManagerScope } from "@/app/api/utils/managerScope";

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

// Current calendar month in the given IANA timezone. The server may run in
// UTC while operations are in Africa/Kampala (UTC+3), so the last hours of
// the local month can still be the prior UTC month.
function getCurrentMonthYearInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  return { month, year };
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
    // ?archived=1 also returns archived (decommissioned) properties.
    const includeArchived = url.searchParams.get("archived") === "1";

    // Recovery period: ?month=1-12&year=YYYY, defaulting to the current
    // Kampala calendar month for whichever param is omitted.
    const current = getCurrentMonthYearInTimezone("Africa/Kampala");
    const monthParam = (url.searchParams.get("month") || "").trim();
    const yearParam = (url.searchParams.get("year") || "").trim();
    const recoveryMonth = monthParam ? Number(monthParam) : current.month;
    const recoveryYear = yearParam ? Number(yearParam) : current.year;
    if (
      !Number.isInteger(recoveryMonth) ||
      recoveryMonth < 1 ||
      recoveryMonth > 12 ||
      !Number.isInteger(recoveryYear) ||
      recoveryYear < 2000 ||
      recoveryYear > 2100
    ) {
      return Response.json({ error: "Invalid month/year" }, { status: 400 });
    }

    const where = includeArchived
      ? []
      : ["COALESCE(is_deleted, false) = false"];
    const values = [];

    if (search.length > 0) {
      values.push(`%${search.toLowerCase()}%`);
      where.push(
        `(LOWER(property_name) LIKE $${values.length} OR LOWER(address) LIKE $${values.length})`,
      );
    }

    // Manager scoping: Portfolio Managers only see properties they are
    // assigned to. Admins/other roles are unaffected (no clause added).
    // A manager with zero assigned properties gets an empty result set,
    // NOT the full list.
    const scope = await getManagerScope(perm);
    if (scope.scoped) {
      values.push(scope.staffId);
      where.push(`assigned_officer_id = $${values.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    values.push(limit);
    const limitPos = values.length;
    values.push(offset);
    const offsetPos = values.length;
    values.push(recoveryMonth);
    const monthPos = values.length;
    values.push(recoveryYear);
    const yearPos = values.length;

    // `base` is the original list query, unchanged; the KPI CTEs are
    // aggregated once over just those property ids and LEFT JOINed on.
    //
    // rent_roll: each unit's monthly_rent_ugx, falling back to its active
    // lease rent (same fallback as reports/rent-roll).
    //
    // recovery: all non-void, non-deleted, approved invoices for the month,
    // INCLUDING those on ended leases — this intentionally differs from
    // reports/manager-comparison, which only counts currently active leases.
    const query = `
      WITH base AS (
        SELECT id, property_name, address, property_type, total_units,
               management_fee_type, management_fee_percent, management_fee_fixed_amount,
               notes, landlord_id, assigned_officer_id, created_by, created_at,
               COALESCE(is_deleted, false) AS is_archived
        FROM properties
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${limitPos}
        OFFSET $${offsetPos}
      ),
      unit_kpis AS (
        SELECT
          u.property_id,
          COUNT(*) FILTER (WHERE u.status = 'occupied')::int AS occupied_units,
          COALESCE(SUM(COALESCE(NULLIF(u.monthly_rent_ugx, 0), al.monthly_rent, 0)), 0) AS rent_roll
        FROM units u
        LEFT JOIN LATERAL (
          SELECT le.monthly_rent
          FROM leases le
          WHERE le.unit_id = u.id
            AND le.status = 'active'
            AND le.start_date <= CURRENT_DATE
            AND le.end_date >= CURRENT_DATE
          ORDER BY le.start_date DESC
          LIMIT 1
        ) al ON true
        WHERE u.property_id IN (SELECT id FROM base)
        GROUP BY u.property_id
      ),
      recovery AS (
        SELECT
          i.property_id,
          COALESCE(SUM(i.amount), 0)      AS billed,
          COALESCE(SUM(i.paid_amount), 0) AS collected
        FROM invoices i
        WHERE i.property_id IN (SELECT id FROM base)
          AND i.invoice_month = $${monthPos}
          AND i.invoice_year = $${yearPos}
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
        GROUP BY i.property_id
      )
      SELECT
        b.*,
        CASE
          WHEN l.id IS NULL THEN NULL
          ELSE CONCAT_WS(' ', NULLIF(l.title, ''), l.full_name)
        END AS landlord_name,
        so.full_name AS manager_name,
        COALESCE(uk.occupied_units, 0) AS occupied_units,
        COALESCE(uk.rent_roll, 0) AS rent_roll,
        COALESCE(r.billed, 0) AS recovery_billed,
        COALESCE(r.collected, 0) AS recovery_collected,
        CASE
          WHEN COALESCE(r.billed, 0) = 0 THEN NULL
          ELSE ROUND(r.collected / r.billed * 100)::int
        END AS recovery_pct
      FROM base b
      LEFT JOIN landlords l ON l.id = b.landlord_id
      LEFT JOIN staff_users so ON so.id = b.assigned_officer_id
      LEFT JOIN unit_kpis uk ON uk.property_id = b.id
      LEFT JOIN recovery r ON r.property_id = b.id
      ORDER BY b.created_at DESC
    `;

    const rows = await sql(query, values);

    // Postgres numerics arrive as strings; return the new money KPIs as numbers.
    const properties = rows.map((r) => ({
      ...r,
      rent_roll: Number(r.rent_roll),
      recovery_billed: Number(r.recovery_billed),
      recovery_collected: Number(r.recovery_collected),
    }));

    return Response.json({
      properties,
      limit,
      offset,
      recovery_month: recoveryMonth,
      recovery_year: recoveryYear,
    });
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
      assigned_officer_id,
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

    let officerId = null;
    if (
      assigned_officer_id !== null &&
      assigned_officer_id !== undefined &&
      assigned_officer_id !== ""
    ) {
      const parsedOfficer = Number(assigned_officer_id);
      if (Number.isFinite(parsedOfficer)) officerId = parsedOfficer;
    }

    const approval = getApprovalFields(perm.staff);
    const created = await sql`
      INSERT INTO properties (
        property_name, address, property_type,
        management_fee_type, management_fee_percent, management_fee_fixed_amount,
        notes,
        landlord_id,
        assigned_officer_id,
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
        ${officerId},
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

    if (approval.approval_status === "pending") {
      notifyAllAdminsAsync({
        title: "New Property Pending Approval",
        message: `New property ${property_name.trim()} has been created and is pending approval. Added by ${perm.staff.full_name || "Staff"}`,
        type: "property",
        reference_id: property?.id,
        reference_type: "property",
      });
    }

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
