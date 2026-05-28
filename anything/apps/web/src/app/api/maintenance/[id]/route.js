import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getAccountIdByCode, ensureCanCreditAccount } from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "maintenance");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const reqId = Number(id);
    if (!reqId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows =
      await sql`SELECT * FROM maintenance_requests WHERE id = ${reqId} LIMIT 1`;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    const title =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    const description =
      typeof body?.description === "string"
        ? body.description.trim()
        : undefined;
    const category =
      typeof body?.category === "string" ? body.category.trim() : undefined;
    const priority =
      typeof body?.priority === "string" ? body.priority.trim() : undefined;
    const status =
      typeof body?.status === "string" ? body.status.trim() : undefined;
    const assignedTo =
      typeof body?.assigned_to === "string"
        ? body.assigned_to.trim()
        : undefined;
    const cost = body?.cost !== undefined ? toNumber(body.cost) : undefined;

    // Completion fields
    const chargeType =
      typeof body?.charge_type === "string" ? body.charge_type.trim() : null;
    const paymentAccountId = toNumber(body?.payment_account_id);
    const completedCost = toNumber(body?.completed_cost);
    const completedDate = parseDate(body?.completed_date);

    // Approval gate: block progression if approval is required but not yet given
    const nextStatus = status !== undefined ? status : existing.status;
    if (
      nextStatus !== "pending" &&
      existing.approval_required &&
      !existing.approved_at
    ) {
      return Response.json(
        {
          error:
            "This request requires approval before it can be progressed.",
        },
        { status: 400 },
      );
    }

    const approvalThreshold = 500000;
    const nextCost = cost !== undefined ? cost : existing.cost;
    const approvalRequired =
      nextCost !== null &&
      nextCost !== undefined &&
      Number(nextCost) > approvalThreshold;

    const isNowCompleted =
      status === "completed" && existing.status !== "completed";

    const completedAt = isNowCompleted
      ? new Date().toISOString()
      : existing.completed_at;

    // GL posting on completion
    let newTransactionId = existing.transaction_id;
    let finalLandlordId = existing.landlord_id;
    let finalChargeType = existing.charge_type;
    let finalPaymentAccountId = existing.payment_account_id;
    let finalCompletedCost = existing.completed_cost;
    let finalCompletedDate = existing.completed_date;

    if (isNowCompleted && completedCost && paymentAccountId && chargeType) {
      // Build GL description: include tenant name when available
      let glDescription;
      if (existing.tenant_id) {
        const tenantRows = await sql`SELECT full_name FROM tenants WHERE id = ${existing.tenant_id} LIMIT 1`;
        const tenantFullName = tenantRows?.[0]?.full_name || null;
        glDescription = tenantFullName
          ? `Maintenance: ${tenantFullName} - ${(existing.title || "").slice(0, 180)}`
          : `Maintenance: ${(existing.title || "").slice(0, 200)}`;
      } else {
        glDescription = `Maintenance: ${(existing.title || "").slice(0, 200)}`;
      }

      // Validate payment account exists and is an asset
      const fundCheck = await ensureCanCreditAccount({
        creditAccountId: paymentAccountId,
        amount: completedCost,
      });
      if (!fundCheck.ok) {
        return Response.json(fundCheck.body, { status: fundCheck.status });
      }

      const txnDate = completedDate || new Date().toISOString().slice(0, 10);

      if (chargeType === "landlord") {
        // Debit 2100 (Due to Landlords) / Credit payment account
        const acct2100Id = await getAccountIdByCode("2100");
        if (!acct2100Id) {
          return Response.json(
            { error: "Account 2100 not configured" },
            { status: 500 },
          );
        }

        // Get landlord_id from property
        const propertyId = existing.property_id;
        if (!propertyId) {
          return Response.json(
            { error: "Maintenance request has no property — cannot charge to landlord" },
            { status: 400 },
          );
        }
        const propRows = await sql`
          SELECT landlord_id FROM properties WHERE id = ${propertyId} LIMIT 1
        `;
        const landlordId = toNumber(propRows?.[0]?.landlord_id);
        if (!landlordId) {
          return Response.json(
            { error: "Property has no landlord configured" },
            { status: 400 },
          );
        }

        const result = await sql.transaction(async (txn) => {
          const [txnRow] = await txn`
            INSERT INTO transactions (
              transaction_date, description,
              debit_account_id, credit_account_id,
              amount, currency,
              created_by, landlord_id, property_id,
              expense_scope, source_type, source_id
            ) VALUES (
              ${txnDate}::date,
              ${glDescription},
              ${acct2100Id}, ${paymentAccountId},
              ${completedCost}, 'UGX',
              ${perm.staff.id}, ${landlordId}, ${propertyId},
              'landlord', 'maintenance', ${reqId}
            ) RETURNING id
          `;

          const [updatedRow] = await txn`
            UPDATE maintenance_requests
            SET
              title          = ${title !== undefined ? title : existing.title},
              description    = ${description !== undefined ? description || null : existing.description},
              category       = ${category !== undefined ? category || null : existing.category},
              priority       = ${priority !== undefined ? priority : existing.priority},
              status         = 'completed',
              assigned_to    = ${assignedTo !== undefined ? assignedTo || null : existing.assigned_to},
              cost           = ${cost !== undefined ? cost : existing.cost},
              approval_required = ${approvalRequired},
              completed_at   = ${completedAt},
              charge_type    = 'landlord',
              payment_account_id = ${paymentAccountId},
              transaction_id = ${Number(txnRow.id)},
              completed_cost = ${completedCost},
              completed_date = ${txnDate}::date,
              landlord_id    = ${landlordId}
            WHERE id = ${reqId}
            RETURNING *
          `;

          return updatedRow;
        });

        await writeAuditLog({
          staffId: perm.staff.id,
          action: "maintenance.update",
          entityType: "maintenance_request",
          entityId: reqId,
          oldValues: existing,
          newValues: result,
          ipAddress: perm.ipAddress,
        });

        return Response.json({ request: result });
      } else if (chargeType === "company") {
        // Debit 5200 (Maintenance Expense) / Credit payment account
        const acct5200Id = await getAccountIdByCode("5200");
        if (!acct5200Id) {
          return Response.json(
            { error: "Account 5200 (Maintenance Expense) not configured" },
            { status: 500 },
          );
        }

        const result = await sql.transaction(async (txn) => {
          const [txnRow] = await txn`
            INSERT INTO transactions (
              transaction_date, description,
              debit_account_id, credit_account_id,
              amount, currency,
              created_by, property_id,
              expense_scope, source_type, source_id
            ) VALUES (
              ${txnDate}::date,
              ${glDescription},
              ${acct5200Id}, ${paymentAccountId},
              ${completedCost}, 'UGX',
              ${perm.staff.id}, ${existing.property_id || null},
              'company', 'maintenance', ${reqId}
            ) RETURNING id
          `;

          const [updatedRow] = await txn`
            UPDATE maintenance_requests
            SET
              title          = ${title !== undefined ? title : existing.title},
              description    = ${description !== undefined ? description || null : existing.description},
              category       = ${category !== undefined ? category || null : existing.category},
              priority       = ${priority !== undefined ? priority : existing.priority},
              status         = 'completed',
              assigned_to    = ${assignedTo !== undefined ? assignedTo || null : existing.assigned_to},
              cost           = ${cost !== undefined ? cost : existing.cost},
              approval_required = ${approvalRequired},
              completed_at   = ${completedAt},
              charge_type    = 'company',
              payment_account_id = ${paymentAccountId},
              transaction_id = ${Number(txnRow.id)},
              completed_cost = ${completedCost},
              completed_date = ${txnDate}::date
            WHERE id = ${reqId}
            RETURNING *
          `;

          return updatedRow;
        });

        await writeAuditLog({
          staffId: perm.staff.id,
          action: "maintenance.update",
          entityType: "maintenance_request",
          entityId: reqId,
          oldValues: existing,
          newValues: result,
          ipAddress: perm.ipAddress,
        });

        return Response.json({ request: result });
      }
    }

    // Non-completion update (or completion without cost — no GL entry)
    const updatedRows = await sql`
      UPDATE maintenance_requests
      SET
        title          = ${title !== undefined ? title : existing.title},
        description    = ${description !== undefined ? description || null : existing.description},
        category       = ${category !== undefined ? category || null : existing.category},
        priority       = ${priority !== undefined ? priority : existing.priority},
        status         = ${status !== undefined ? status : existing.status},
        assigned_to    = ${assignedTo !== undefined ? assignedTo || null : existing.assigned_to},
        cost           = ${cost !== undefined ? cost : existing.cost},
        approval_required = ${approvalRequired},
        completed_at   = ${completedAt ? completedAt : null}
      WHERE id = ${reqId}
      RETURNING *
    `;

    const updated = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "maintenance.update",
      entityType: "maintenance_request",
      entityId: reqId,
      oldValues: existing,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ request: updated });
  } catch (error) {
    console.error("PUT /api/maintenance/[id] error:", error.message, "\n", error.stack);
    return Response.json(
      { error: error.message || "Failed to update maintenance request" },
      { status: 500 },
    );
  }
}
