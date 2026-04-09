import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoicesForLease } from "@/app/api/utils/invoices";
import { getAccountIdByCode } from "@/app/api/utils/accounting";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

const OPEN_ENDED_END_DATE = "2099-12-31";

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

    const unitId = toNumber(body?.unit_id);
    const tenantId = toNumber(body?.tenant_id);
    const startDate = (body?.start_date || "").trim();
    const rawEndDate = (body?.end_date || "").trim();
    const endDate = rawEndDate || OPEN_ENDED_END_DATE;
    const monthlyRent = toNumber(body?.monthly_rent);
    const currency = "UGX"; // Hardcoded to UGX only
    const depositAmount = toNumber(body?.deposit_amount);
    const billingDay = toNumber(body?.billing_day) || 1;
    const autoRenew = body?.auto_renew === true;

    if (!unitId || !tenantId || !startDate || !monthlyRent) {
      return Response.json(
        {
          error: "unit_id, tenant_id, start_date, monthly_rent are required",
        },
        { status: 400 },
      );
    }

    // Prevent double assignment: overlapping active lease on same unit
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

    const inserted = await sql`
      INSERT INTO leases (
        unit_id, tenant_id, start_date, end_date, monthly_rent, currency,
        deposit_amount, deposit_paid, billing_day, auto_renew, status, created_by
      )
      VALUES (
        ${unitId}, ${tenantId}, ${startDate}::date, ${endDate}::date, ${monthlyRent}, ${currency},
        ${depositAmount}, 0, ${billingDay}, ${autoRenew}, 'active', ${perm.staff.id}
      )
      RETURNING *
    `;

    const lease = inserted?.[0] || null;

    // Update unit status
    await sql`UPDATE units SET status = 'occupied' WHERE id = ${unitId}`;

    // NEW: Post security deposit accounting transaction if deposit_amount > 0
    if (depositAmount && depositAmount > 0) {
      try {
        const undepositedFundsId = await getAccountIdByCode("1130");
        const tenantDepositsPayableId = await getAccountIdByCode("2200");

        if (undepositedFundsId && tenantDepositsPayableId) {
          // Get tenant name
          const tenantRows = await sql`
            SELECT full_name FROM tenants WHERE id = ${tenantId} LIMIT 1
          `;
          const tenantName = tenantRows?.[0]?.full_name || "Tenant";
          const depositDescription = `Security deposit - ${tenantName}`;
          const todayYmd = new Date().toISOString().slice(0, 10);

          await sql`
            INSERT INTO transactions (
              transaction_date, description, reference_number,
              debit_account_id, credit_account_id,
              amount, currency,
              created_by,
              source_type, source_id
            )
            VALUES (
              ${todayYmd}::date, ${depositDescription}, ${`SD-${lease?.id}`},
              ${undepositedFundsId}, ${tenantDepositsPayableId},
              ${depositAmount}, ${currency},
              ${perm.staff.id},
              'security_deposit', ${lease?.id}
            )
          `;
        }
      } catch (depositError) {
        console.error(
          "Failed to post security deposit transaction; continuing",
          depositError,
        );
        // Non-critical: don't fail the whole lease creation
      }
    }

    // Ensure invoices exist for this lease (creates current month invoice + any missing)
    if (lease?.id) {
      await ensureInvoicesForLease(lease.id);
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "lease.create",
      entityType: "lease",
      entityId: lease?.id || null,
      oldValues: null,
      newValues: lease,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about new lease
    // Get tenant, unit, and property details for notification
    if (lease?.id) {
      const detailsRows = await sql`
        SELECT 
          t.full_name AS tenant_name,
          u.unit_number,
          p.property_name
        FROM leases l
        JOIN tenants t ON t.id = l.tenant_id
        JOIN units u ON u.id = l.unit_id
        JOIN properties p ON p.id = u.property_id
        WHERE l.id = ${lease.id}
        LIMIT 1
      `;

      const details = detailsRows?.[0];
      if (details) {
        notifyAllAdminsAsync({
          title: "New Lease Created",
          message: `New lease created for ${details.tenant_name} in Unit ${details.unit_number} at ${details.property_name} - ${currency} ${Number(monthlyRent).toLocaleString()}/month. Created by ${perm.staff.full_name || "Staff"}`,
          type: "lease",
          reference_id: lease.id,
          reference_type: "lease",
        });
      }
    }

    return Response.json({ lease });
  } catch (error) {
    console.error("POST /api/leases error", error);
    return Response.json({ error: "Failed to create lease" }, { status: 500 });
  }
}

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const leases = await sql`
      SELECT 
        l.id,
        l.tenant_id,
        l.monthly_rent,
        l.currency,
        l.status,
        t.full_name AS tenant_name,
        t.title AS tenant_title,
        p.id AS property_id,
        p.property_name,
        u.id AS unit_id,
        u.unit_number
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.status = 'active'
      ORDER BY p.property_name, u.unit_number, t.full_name
    `;

    return Response.json({ leases: leases || [] });
  } catch (error) {
    console.error("GET /api/leases error", error);
    return Response.json({ error: "Failed to fetch leases" }, { status: 500 });
  }
}
