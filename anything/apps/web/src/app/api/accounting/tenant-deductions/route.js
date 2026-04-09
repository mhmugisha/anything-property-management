import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { ensureCanCreditAccount } from "@/app/api/utils/accounting";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function getAccountIdByCode(code) {
  const rows = await sql`
    SELECT id FROM chart_of_accounts WHERE account_code = ${code} LIMIT 1
  `;
  return rows?.[0]?.id || null;
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const landlordIdFromBody = toNumber(body?.landlord_id);
    const tenantId = toNumber(body?.tenant_id);
    const propertyIdFromBody = toNumber(body?.property_id);
    const deductionDate = (body?.deduction_date || "").trim();
    const description = (body?.description || "").trim();
    const amount = toNumber(body?.amount);
    const paymentAccountId = toNumber(body?.payment_account_id);

    if (
      !tenantId ||
      !deductionDate ||
      !description ||
      !amount ||
      !paymentAccountId
    ) {
      return Response.json(
        {
          error:
            "tenant_id, deduction_date, description, amount, and payment_account_id are required",
        },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return Response.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    // Validate that the payment account exists and is one of the allowed accounts (1110 or 1120)
    const accountCheck = await sql`
      SELECT id, account_code, account_name 
      FROM chart_of_accounts 
      WHERE id = ${paymentAccountId} 
        AND account_code IN ('1110', '1120')
        AND COALESCE(is_active, true) = true
    `;

    if (accountCheck.length === 0) {
      return Response.json(
        {
          error:
            "Invalid payment account. Must be Cash on Hand (1110) or Bank Account - Operating (1120)",
        },
        { status: 400 },
      );
    }

    // Derive landlord/property from tenant's active lease (used for reporting)
    const currentRows = await sql`
      SELECT
        p.id AS property_id,
        p.landlord_id AS landlord_id
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.tenant_id = ${tenantId}
        AND l.status = 'active'
      ORDER BY l.start_date DESC
      LIMIT 1
    `;

    const derivedPropertyId = currentRows?.[0]?.property_id || null;
    const derivedLandlordId = currentRows?.[0]?.landlord_id || null;

    const propertyId = propertyIdFromBody || derivedPropertyId;
    const landlordId = landlordIdFromBody || derivedLandlordId;

    const creditAccountId = paymentAccountId;

    // NEW: prevent spending more than what's available in the credited Asset account.
    const guard = await ensureCanCreditAccount({
      creditAccountId,
      amount,
    });
    if (!guard.ok) {
      return Response.json(guard.body, { status: guard.status });
    }

    const rows = await sql`
      INSERT INTO tenant_deductions (
        tenant_id, property_id, deduction_date, description, amount, created_by,
        is_deleted
      )
      VALUES (
        ${tenantId}, ${propertyId || null}, ${deductionDate}::date, ${description}, ${amount}, ${perm.staff.id},
        false
      )
      RETURNING *
    `;

    const deduction = rows?.[0] || null;

    // Accounting: Dr Rent Receivable (asset), Cr Cash/Bank (we paid the expense on behalf of tenant)
    const receivableId = await getAccountIdByCode("1210");

    if (!receivableId || !creditAccountId) {
      return Response.json(
        { error: "Accounting accounts not set up correctly" },
        { status: 500 },
      );
    }

    const txDesc = `Tenant deduction - ${description}`;

    const txRows = await sql`
      INSERT INTO transactions (
        transaction_date, description, reference_number,
        debit_account_id, credit_account_id,
        amount, currency, created_by,
        landlord_id, property_id,
        expense_scope,
        source_type, source_id
      )
      VALUES (
        ${deductionDate}::date, ${txDesc}, NULL,
        ${receivableId}, ${creditAccountId},
        ${amount}, 'UGX', ${perm.staff.id},
        ${landlordId || null}, ${propertyId || null},
        'tenant',
        'tenant_deduction', ${deduction.id}
      )
      RETURNING *
    `;

    const tx = txRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "tenant.deduction.create",
      entityType: "tenant_deduction",
      entityId: deduction?.id || null,
      oldValues: null,
      newValues: deduction,
      ipAddress: perm.ipAddress,
    });

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.transaction.create",
      entityType: "transaction",
      entityId: tx?.id || null,
      oldValues: null,
      newValues: tx,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ deduction, transaction: tx });
  } catch (error) {
    console.error("POST /api/accounting/tenant-deductions error", error);
    return Response.json(
      { error: "Failed to create tenant deduction" },
      { status: 500 },
    );
  }
}
