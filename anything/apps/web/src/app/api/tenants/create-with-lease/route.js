import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoicesForLease } from "@/app/api/utils/invoices";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

const OPEN_ENDED_END_DATE = "2099-12-31";
const ALLOWED_TITLES = new Set(["Mr.", "Ms.", "Dr."]);

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

// NEW: return a safe, human-readable error message to the UI.
function safeErrorMessage(error) {
  if (!error) return "Unknown error";

  const msg = typeof error.message === "string" ? error.message : String(error);

  // If this is a Postgres error, include the code/detail (still safe for staff UI).
  const code = typeof error.code === "string" ? error.code : null;
  const detail = typeof error.detail === "string" ? error.detail : null;

  let out = msg;
  if (code) out = `${out} (code: ${code})`;
  if (detail) out = `${out} - ${detail}`;

  // Prevent extremely long responses.
  if (out.length > 600) {
    out = out.slice(0, 600) + "…";
  }

  return out;
}

export async function POST(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  let createdTenantId = null;
  let createdLeaseId = null;
  let updatedUnitId = null;

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
      SELECT u.id, u.status, u.property_id, u.unit_number, p.property_name
      FROM units u
      LEFT JOIN properties p ON p.id = u.property_id
      WHERE u.id = ${unitId}
      LIMIT 1
    `;

    const unit = unitRows?.[0] || null;

    if (!unit || !unit.property_id) {
      return Response.json({ error: "Unit not found" }, { status: 404 });
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

    // Create tenant first
    const tenantRows = await sql`
      INSERT INTO tenants (title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status)
      VALUES (${title}, ${fullName}, ${phone}, ${email}, ${nationalId}, ${emergencyContact}, ${emergencyPhone}, ${status})
      RETURNING id, title, full_name, phone, email, national_id, emergency_contact, emergency_phone, status, created_at
    `;

    const tenant = tenantRows?.[0] || null;
    createdTenantId = tenant?.id || null;

    if (!createdTenantId) {
      return Response.json(
        { error: "Failed to create tenant" },
        { status: 500 },
      );
    }

    // Create lease and mark unit occupied
    const leaseRows = await sql`
      INSERT INTO leases (
        unit_id, tenant_id, start_date, end_date, monthly_rent, currency,
        deposit_amount, deposit_paid, billing_day, auto_renew, status, created_by
      )
      VALUES (
        ${unitId}, ${createdTenantId}, ${startDate}::date, ${endDate}::date, ${monthlyRent}, ${currency},
        ${depositAmount}, 0, ${billingDay}, ${autoRenew}, 'active', ${perm.staff.id}
      )
      RETURNING *
    `;

    const lease = leaseRows?.[0] || null;
    createdLeaseId = lease?.id || null;

    if (!createdLeaseId) {
      return Response.json(
        { error: "Failed to create lease" },
        { status: 500 },
      );
    }

    await sql`UPDATE units SET status = 'occupied' WHERE id = ${unitId}`;
    updatedUnitId = unitId;

    // NEW: Post security deposit accounting transaction if deposit_amount > 0
    if (depositAmount && depositAmount > 0) {
      try {
        const undepositedFundsId = await getAccountIdByCode("1130");
        const tenantDepositsPayableId = await getAccountIdByCode("2200");

        if (undepositedFundsId && tenantDepositsPayableId) {
          const depositDescription = `Security deposit - ${fullName}`;
          const todayYmd = new Date().toISOString().slice(0, 10);

          await sql`
            INSERT INTO transactions (
              transaction_date, description, reference_number,
              debit_account_id, credit_account_id,
              amount, currency,
              created_by,
              property_id,
              source_type, source_id
            )
            VALUES (
              ${todayYmd}::date, ${depositDescription}, ${`SD-${createdLeaseId}`},
              ${undepositedFundsId}, ${tenantDepositsPayableId},
              ${depositAmount}, ${currency},
              ${perm.staff.id},
              ${unit.property_id},
              'security_deposit', ${createdLeaseId}
            )
          `;
        }
      } catch (depositError) {
        console.error(
          "Failed to post security deposit transaction; continuing",
          depositError,
        );
        // Non-critical: don't fail the whole tenant creation
      }
    }

    // Ensure invoices exist immediately.
    // IMPORTANT: Tenant creation should not fail if invoice generation fails, but we SHOULD surface this
    // clearly so staff can act quickly.
    let invoiceWarning = null;
    let invoiceInsertedCount = null;

    const isStartDateLikelyInPastOrCurrent = (() => {
      try {
        const sd = new Date(`${startDate}T00:00:00Z`);
        if (Number.isNaN(sd.getTime())) return false;
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);
        return sd.getTime() <= currentMonthStart.getTime();
      } catch {
        return false;
      }
    })();

    try {
      invoiceInsertedCount = await ensureInvoicesForLease(createdLeaseId);

      // If we expected at least one invoice but got none, flag it.
      if (
        isStartDateLikelyInPastOrCurrent &&
        Number(invoiceInsertedCount || 0) === 0
      ) {
        invoiceWarning =
          "No invoices were generated for this lease. This can happen if invoice generation was skipped or the lease/property setup blocks billing.";
      }
    } catch (e) {
      console.error(
        "ensureInvoicesForLease failed during tenant creation; retrying once",
        e,
      );

      // quick one-time retry (helps with transient locks)
      try {
        await new Promise((r) => setTimeout(r, 200));
        invoiceInsertedCount = await ensureInvoicesForLease(createdLeaseId);

        if (
          isStartDateLikelyInPastOrCurrent &&
          Number(invoiceInsertedCount || 0) === 0
        ) {
          invoiceWarning =
            "No invoices were generated for this lease. This can happen if invoice generation was skipped or the lease/property setup blocks billing.";
        }
      } catch (e2) {
        console.error(
          "ensureInvoicesForLease failed during tenant creation; continuing",
          e2,
        );
        invoiceWarning = safeErrorMessage(e2);
      }
    }

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

    // Best-effort cleanup if tenant/lease were created but later steps failed.
    try {
      if (updatedUnitId) {
        await sql`UPDATE units SET status = 'vacant' WHERE id = ${updatedUnitId}`;
      }
    } catch (cleanupError) {
      console.error("Cleanup failed for unit", cleanupError);
    }

    try {
      if (createdLeaseId) {
        await sql`DELETE FROM leases WHERE id = ${createdLeaseId}`;
      }
    } catch (cleanupError) {
      console.error("Cleanup failed for lease", cleanupError);
    }

    try {
      if (createdTenantId) {
        await sql`DELETE FROM tenants WHERE id = ${createdTenantId}`;
      }
    } catch (cleanupError) {
      console.error("Cleanup failed for tenant", cleanupError);
    }

    return Response.json(
      {
        error: `Failed to create tenant and assign unit: ${safeErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
