import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getApprovalFields } from "@/app/api/utils/approval";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";
import { materializeTenantWithLease } from "@/app/api/utils/tenants/materializeTenantWithLease";
import {
  ensureInvoicesForNewLease,
  safeErrorMessage,
} from "@/app/api/utils/tenants/leaseInvoices";

const OPEN_ENDED_END_DATE = "2099-12-31";
const ALLOWED_TITLES = new Set(["Mr.", "Ms.", "Dr."]);

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

export async function POST(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

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

    const email = (body?.email || "").trim() || null;
    const nationalId = (body?.national_id || "").trim() || null;
    const emergencyContact = (body?.emergency_contact || "").trim() || null;
    const emergencyPhone = (body?.emergency_phone || "").trim() || null;
    const status = (body?.status || "active").trim();

    const unitId = toNumber(body?.unit_id);
    const startDate = (body?.start_date || "").trim();
    const rawEndDate = (body?.end_date || "").trim();
    const endDate = rawEndDate || OPEN_ENDED_END_DATE;
    const monthlyRent = toNumber(body?.monthly_rent);
    const currency = (body?.currency || "UGX").trim();
    const depositAmount = toNumber(body?.deposit_amount);
    const billingDay = toNumber(body?.billing_day) || 1;
    const autoRenew = body?.auto_renew === true;

    if (!fullName || !phone) {
      return Response.json(
        { error: "full_name and phone are required" },
        { status: 400 },
      );
    }

    if (!unitId || !startDate || !monthlyRent) {
      return Response.json(
        {
          error:
            "unit_id, start_date, monthly_rent are required to assign this tenant to a unit",
        },
        { status: 400 },
      );
    }

    // Basic date validation (helps avoid cryptic DB cast errors)
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return Response.json(
        { error: "Invalid start_date or end_date" },
        { status: 400 },
      );
    }
    if (endMs < startMs) {
      return Response.json(
        { error: "end_date cannot be before start_date" },
        { status: 400 },
      );
    }

    const unitRows = await sql`
      SELECT u.id, u.status, u.property_id, u.unit_number, p.property_name,
             COALESCE(p.is_deleted, false) AS property_archived
      FROM units u
      LEFT JOIN properties p ON p.id = u.property_id
      WHERE u.id = ${unitId}
      LIMIT 1
    `;

    const unit = unitRows?.[0] || null;

    if (!unit || !unit.property_id) {
      return Response.json({ error: "Unit not found" }, { status: 404 });
    }

    if (unit.property_archived) {
      return Response.json(
        { error: "This unit's property is archived and can't take new leases" },
        { status: 409 },
      );
    }

    // Truthy vacancy check: no active lease overlaps at all.
    // This avoids cases where units.status is out of sync.
    const overlap = await sql`
      SELECT id FROM leases
      WHERE unit_id = ${unitId}
        AND status = 'active'
        AND start_date <= ${endDate}::date
        AND end_date >= ${startDate}::date
      LIMIT 1
    `;

    if (overlap.length > 0) {
      return Response.json(
        {
          error:
            "This unit already has an active lease in the selected date range",
        },
        { status: 409 },
      );
    }

    // Non-admin: hold the whole request in tenant_submissions. No tenant,
    // lease, unit change, deposit or invoice exists until an admin approves.
    if (perm.staff.role_name !== "Admin") {
      const pendingClash = await sql`
        SELECT id FROM tenant_submissions
        WHERE unit_id = ${unitId}
          AND start_date <= ${endDate}::date
          AND end_date >= ${startDate}::date
        LIMIT 1
      `;

      if (pendingClash.length > 0) {
        return Response.json(
          {
            error:
              "Another tenant submission for this unit and date range is already awaiting approval",
          },
          { status: 409 },
        );
      }

      const submissionRows = await sql`
        INSERT INTO tenant_submissions (
          title, full_name, phone, email, national_id, emergency_contact, emergency_phone,
          unit_id, start_date, end_date, monthly_rent, currency,
          deposit_amount, billing_day, auto_renew, requested_by
        )
        VALUES (
          ${title}, ${fullName}, ${phone}, ${email}, ${nationalId}, ${emergencyContact}, ${emergencyPhone},
          ${unitId}, ${startDate}::date, ${endDate}::date, ${monthlyRent}, ${currency},
          ${depositAmount}, ${billingDay}, ${autoRenew}, ${perm.staff.id}
        )
        RETURNING *
      `;

      const submission = submissionRows?.[0] || null;

      try {
        await writeAuditLog({
          staffId: perm.staff.id,
          action: "tenant_submission.create",
          entityType: "tenant_submission",
          entityId: submission?.id || null,
          oldValues: null,
          newValues: submission,
          ipAddress: perm.ipAddress,
        });
      } catch (e) {
        console.error("Failed to write audit log for tenant_submission.create", e);
      }

      notifyAllAdminsAsync({
        title: "New Tenant Pending Approval",
        message: `New tenant ${fullName} for ${unit.property_name || "property"} unit ${unit.unit_number || ""} is pending approval. Submitted by ${perm.staff.full_name || "Staff"}`,
        type: "tenant",
        reference_id: submission?.id,
        reference_type: "tenant_submission",
      });

      return Response.json({ submission, pending: true }, { status: 201 });
    }

    // Admin: create tenant + lease + unit occupancy + deposit atomically.
    const created = await materializeTenantWithLease({
      values: {
        title,
        full_name: fullName,
        phone,
        email,
        national_id: nationalId,
        emergency_contact: emergencyContact,
        emergency_phone: emergencyPhone,
        unit_id: unitId,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: monthlyRent,
        currency,
        deposit_amount: depositAmount,
        billing_day: billingDay,
        auto_renew: autoRenew,
        created_by: perm.staff.id,
      },
      tenantStatus: status,
      approval: getApprovalFields(perm.staff),
      unitId,
    });

    if (!created) {
      // The unit was let (or its property archived) since validation above.
      return Response.json(
        {
          error:
            "This unit already has an active lease in the selected date range",
        },
        { status: 409 },
      );
    }

    const { tenant, lease } = created;

    // Tenant creation must not fail on invoicing; problems become a warning.
    const { invoiceInsertedCount, invoiceWarning } =
      await ensureInvoicesForNewLease(lease.id, startDate);

    // Audit logs are best-effort
    try {
      await writeAuditLog({
        staffId: perm.staff.id,
        action: "tenant.create",
        entityType: "tenant",
        entityId: tenant?.id || null,
        oldValues: null,
        newValues: tenant,
        ipAddress: perm.ipAddress,
      });
    } catch (e) {
      console.error("Failed to write audit log for tenant.create", e);
    }

    try {
      await writeAuditLog({
        staffId: perm.staff.id,
        action: "lease.create",
        entityType: "lease",
        entityId: lease?.id || null,
        oldValues: null,
        newValues: lease,
        ipAddress: perm.ipAddress,
      });
    } catch (e) {
      console.error("Failed to write audit log for lease.create", e);
    }

    return Response.json({
      tenant,
      lease,
      unit: {
        id: unit.id,
        unit_number: unit.unit_number,
        property_id: unit.property_id,
        property_name: unit.property_name,
      },
      invoiceInsertedCount: invoiceInsertedCount ?? null,
      ...(invoiceWarning
        ? { warning: `Invoices were not generated yet: ${invoiceWarning}` }
        : {}),
    });
  } catch (error) {
    console.error("POST /api/tenants/create-with-lease error", error);

    // Tenant, lease, unit and deposit are written in one statement, so a
    // failure leaves nothing behind to clean up.
    return Response.json(
      {
        error: `Failed to create tenant and assign unit: ${safeErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
