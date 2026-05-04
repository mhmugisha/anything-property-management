import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getApprovalFields } from "@/app/api/utils/approval";

const ALLOWED_TITLES = new Set(["Mr.", "Ms.", "Dr."]);

export async function GET(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) {
    return Response.json(perm.body, { status: perm.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const landlordIdRaw = (searchParams.get("landlordId") || "").trim();
    const landlordId = landlordIdRaw ? Number(landlordIdRaw) : null;
    const propertyIdRaw = (searchParams.get("propertyId") || "").trim();
    const propertyId = propertyIdRaw ? Number(propertyIdRaw) : null;
    const includeArchived =
      (searchParams.get("includeArchived") || "").trim() === "1";

    // Default behavior (active list): only tenants that currently have an ACTIVE lease.
    if (!includeArchived) {
      const baseSelect = `
        SELECT DISTINCT
          t.id,
          t.title,
          t.full_name,
          t.phone,
          t.email,
          t.national_id,
          t.emergency_contact,
          t.emergency_phone,
          t.status,
          'active'::text AS lease_status,
          t.created_at
        FROM tenants t
      `;

      const joinsForLandlord = `
        JOIN leases l ON l.tenant_id = t.id AND l.status = 'active'
        JOIN units u ON u.id = l.unit_id
        JOIN properties p ON p.id = u.property_id
      `;

      let where = "";
      const params = [];

      // hide archived from active lists
      where += `${where ? " AND " : " WHERE "}COALESCE(t.status, 'active') <> 'archived'`;

      if (landlordId) {
        params.push(landlordId);
        where += `${where ? " AND " : " WHERE "}p.landlord_id = $${params.length}`;
      }

      if (propertyId) {
        params.push(propertyId);
        where += `${where ? " AND " : " WHERE "}p.id = $${params.length}`;
      }

      if (search) {
        const like = `%${search}%`;
        params.push(like);
        const pIdx = params.length;
        where += `${where ? " AND " : " WHERE "}(
          LOWER(t.full_name) LIKE LOWER($${pIdx})
          OR LOWER(COALESCE(t.title, '')) LIKE LOWER($${pIdx})
          OR t.phone LIKE $${pIdx}
          OR LOWER(COALESCE(t.email, '')) LIKE LOWER($${pIdx})
        )`;
      }

      // Always join leases/units/properties so "All landlords" still only shows active-lease tenants.
      const query = `${baseSelect}\n${joinsForLandlord}\n${where}\nORDER BY t.created_at DESC\nLIMIT 200`;

      const tenants = await sql(query, params);

      return Response.json({ tenants });
    }

    // includeArchived=1: show tenants under this landlord even if the lease is ended,
    // so archived tenants can be reactivated.
    const params = [];
    let where = "";

    if (landlordId) {
      params.push(landlordId);
      where += `${where ? " AND " : " WHERE "}cl.landlord_id = $${params.length}`;
    }

    if (propertyId) {
      params.push(propertyId);
      where += `${where ? " AND " : " WHERE "}cl.property_id = $${params.length}`;
    }

    if (search) {
      const like = `%${search}%`;
      params.push(like);
      const pIdx = params.length;
      where += `${where ? " AND " : " WHERE "}(
        LOWER(t.full_name) LIKE LOWER($${pIdx})
        OR LOWER(COALESCE(t.title, '')) LIKE LOWER($${pIdx})
        OR t.phone LIKE $${pIdx}
        OR LOWER(COALESCE(t.email, '')) LIKE LOWER($${pIdx})
      )`;
    }

    const query = `
      SELECT
        t.id,
        t.title,
        t.full_name,
        t.phone,
        t.email,
        t.national_id,
        t.emergency_contact,
        t.emergency_phone,
        t.status,
        COALESCE(cl.lease_status, 'none')::text AS lease_status,
        cl.end_date AS lease_end_date,
        t.created_at
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT
          p.landlord_id,
          p.id AS property_id,
          l.status AS lease_status,
          l.end_date
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        JOIN properties p ON p.id = u.property_id
        WHERE l.tenant_id = t.id
        ORDER BY l.start_date DESC
        LIMIT 1
      ) cl ON true
      ${where}
      ORDER BY t.created_at DESC
      LIMIT 200
    `;

    const tenants = await sql(query, params);

    return Response.json({ tenants });
  } catch (error) {
    console.error("GET /api/tenants error", error);
    return Response.json({ error: "Failed to fetch tenants" }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) {
    return Response.json(perm.body, { status: perm.status });
  }

  try {
    const body = await request.json();
    const rawTitle = (body?.title || "").trim();
    const title = rawTitle
      ? ALLOWED_TITLES.has(rawTitle)
        ? rawTitle
        : null
      : null;
    const fullName = (body?.full_name || "").trim();
    const phone = (body?.phone || "").trim();

    if (!fullName || !phone) {
      return Response.json(
        { error: "full_name and phone are required" },
        { status: 400 },
      );
    }

    const email = (body?.email || "").trim() || null;
    const nationalId = (body?.national_id || "").trim() || null;
    const emergencyContact = (body?.emergency_contact || "").trim() || null;
    const emergencyPhone = (body?.emergency_phone || "").trim() || null;
    const status = (body?.status || "active").trim();

    const approval = getApprovalFields(perm.staff);
    const rows = await sql`
      INSERT INTO tenants (title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, approval_status, approved_by, approved_at)
      VALUES (${title}, ${fullName}, ${phone}, ${email}, ${nationalId}, ${emergencyContact}, ${emergencyPhone}, ${status}, ${approval.approval_status}, ${approval.approved_by}, ${approval.approved_at})
      RETURNING id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
    `;

    const tenant = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "tenant.create",
      entityType: "tenant",
      entityId: tenant?.id || null,
      oldValues: null,
      newValues: tenant,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ tenant });
  } catch (error) {
    console.error("POST /api/tenants error", error);
    return Response.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}
