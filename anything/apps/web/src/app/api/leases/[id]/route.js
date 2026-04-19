import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureInvoicesForLease } from "@/app/api/utils/invoices";
import { getAccountIdByCode } from "@/app/api/utils/accounting";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

const OPEN_ENDED_END_DATE = "2099-12-31";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const leaseId = toNumber(id);
    if (!leaseId) {
      return Response.json({ error: "Invalid lease id" }, { status: 400 });
    }

    const oldRows = await sql`
      SELECT *
      FROM leases
      WHERE id = ${leaseId}
      LIMIT 1
    `;

    const oldLease = oldRows?.[0] || null;
    if (!oldLease) {
      return Response.json({ error: "Lease not found" }, { status: 404 });
    }

    const body = await request.json();

    const unitId = toNumber(body?.unit_id);
    const startDate =
      typeof body?.start_date === "string" ? body.start_date.trim() : null;
    const rawEndDate =
      typeof body?.end_date === "string" ? body.end_date.trim() : "";
    const endDate = rawEndDate || OPEN_ENDED_END_DATE;
    const monthlyRent = toNumber(body?.monthly_rent);
    const currency =
      typeof body?.currency === "string" ? body.currency.trim() : null;
    const depositAmount =
      body?.deposit_amount === "" ? null : toNumber(body?.deposit_amount);

    if (!unitId || !startDate || !monthlyRent || !currency) {
      return Response.json(
        {
          error: "unit_id, start_date, monthly_rent, currency are required",
        },
        { status: 400 },
      );
    }

    // Validate unit exists
    const unitRows = await sql`
      SELECT u.id, u.status, u.property_id,
             p.management_fee_type, p.management_fee_percent, p.management_fee_fixed_amount
      FROM units u
      LEFT JOIN properties p ON p.id = u.property_id
      WHERE u.id = ${unitId}
      LIMIT 1
    `;

    const unit = unitRows?.[0] || null;
    if (!unit || !unit.property_id) {
      return Response.json({ error: "Unit not found" }, { status: 404 });
    }

    // If changing unit, require the new unit to be vacant
    if (Number(unitId) !== Number(oldLease.unit_id)) {
      if (unit.status !== "vacant") {
        return Response.json({ error: "Unit is not vacant" }, { status: 409 });
      }

      // Prevent overlap on new unit
      const overlap = await sql`
        SELECT id FROM leases
        WHERE unit_id = ${unitId}
          AND status = 'active'
          AND id <> ${leaseId}
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
    }

    const updatedRows = await sql`
      UPDATE leases
      SET unit_id = ${unitId},
          start_date = ${startDate}::date,
          end_date = ${endDate}::date,
          monthly_rent = ${monthlyRent},
          currency = ${currency},
          deposit_amount = ${depositAmount}
      WHERE id = ${leaseId}
      RETURNING *
    `;

    const lease = updatedRows?.[0] || null;

    // Sync rent back to unit
    await sql`
      UPDATE units
      SET monthly_rent_ugx = ${monthlyRent}
      WHERE id = ${unitId}
    `;

    // If unit changed, free old unit and occupy new unit
    if (Number(unitId) !== Number(oldLease.unit_id)) {
      await sql`UPDATE units SET status = 'vacant' WHERE id = ${oldLease.unit_id}`;
      await sql`UPDATE units SET status = 'occupied' WHERE id = ${unitId}`;
    }

    // NEW: Post security deposit difference accounting transaction if deposit_amount changed
    const oldDeposit = Number(oldLease.deposit_amount || 0);
    const newDeposit = Number(depositAmount || 0);
    const depositDiff = newDeposit - oldDeposit;

    if (depositDiff > 0) {
      try {
        const undepositedFundsId = await getAccountIdByCode("1130");
        const tenantDepositsPayableId = await getAccountIdByCode("2200");

        if (undepositedFundsId && tenantDepositsPayableId) {
          // Get tenant name
          const tenantRows = await sql`
            SELECT full_name FROM tenants WHERE id = ${oldLease.tenant_id} LIMIT 1
          `;
          const tenantName = tenantRows?.[0]?.full_name || "Tenant";
          const depositDescription = `Security deposit adjustment - ${tenantName}`;
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
              ${todayYmd}::date, ${depositDescription}, ${`SD-ADJ-${leaseId}`},
              ${undepositedFundsId}, ${tenantDepositsPayableId},
              ${depositDiff}, ${currency},
              ${perm.staff.id},
              'security_deposit_adjustment', ${leaseId}
            )
          `;
        }
      } catch (depositError) {
        console.error(
          "Failed to post security deposit adjustment transaction; continuing",
          depositError,
        );
      }
    }

    // Keep future unpaid invoices in sync (unit/property, amount).
    // Management fees are no longer stored per invoice line.
    await sql`
      UPDATE invoices
      SET unit_id = ${unitId},
          property_id = ${unit.property_id},
          amount = ${monthlyRent},
          currency = ${currency},
          commission_rate = 0,
          commission_amount = 0
      WHERE lease_id = ${leaseId}
        AND status <> 'paid'
        AND paid_amount = 0
    `;

    // Ensure invoices exist (handles newly extended date range up to current month)
    await ensureInvoicesForLease(leaseId);

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "lease.update",
      entityType: "lease",
      entityId: leaseId,
      oldValues: oldLease,
      newValues: lease,
      ipAddress: perm.ipAddress,
    });

    // 🔔 Notify admins about lease update
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
        WHERE l.id = ${leaseId}
        LIMIT 1
      `;

      const details = detailsRows?.[0];
      if (details) {
        // Determine what changed for a more specific message
        const changes = [];
        if (Number(unitId) !== Number(oldLease.unit_id)) {
          changes.push("unit changed");
        }
        if (Number(monthlyRent) !== Number(oldLease.monthly_rent)) {
          changes.push(
            `rent updated to ${currency} ${Number(monthlyRent).toLocaleString()}`,
          );
        }
        if (
          Number(depositAmount || 0) !== Number(oldLease.deposit_amount || 0)
        ) {
          changes.push("deposit adjusted");
        }

        const changeMsg = changes.length > 0 ? ` (${changes.join(", ")})` : "";

        notifyAllAdminsAsync({
          title: "Lease Updated",
          message: `Lease updated for ${details.tenant_name} in Unit ${details.unit_number} at ${details.property_name}${changeMsg}. Updated by ${perm.staff.full_name || "Staff"}`,
          type: "lease",
          reference_id: leaseId,
          reference_type: "lease",
        });
      }
    }

    return Response.json({ lease });
  } catch (error) {
    console.error("PUT /api/leases/[id] error", error);
    return Response.json({ error: "Failed to update lease" }, { status: 500 });
  }
}
