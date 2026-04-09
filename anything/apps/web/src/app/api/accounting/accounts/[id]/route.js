import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

const ALLOWED_TYPES = new Set([
  "Asset",
  "Liability",
  "Income",
  "Expense",
  "Equity",
]);

// GET single account by ID
export async function GET(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const accountId = Number(id);
    if (!accountId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, account_code, account_name, account_type, parent_account_id, is_active, created_at
      FROM chart_of_accounts
      WHERE id = ${accountId}
      LIMIT 1
    `;

    const account = rows?.[0] || null;
    if (!account) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    return Response.json({ account });
  } catch (error) {
    console.error("GET /api/accounting/accounts/[id] error", error);
    return Response.json({ error: "Failed to fetch account" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const accountId = Number(id);
    if (!accountId) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existingRows =
      await sql`SELECT * FROM chart_of_accounts WHERE id = ${accountId} LIMIT 1`;
    const existing = existingRows?.[0] || null;
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();

    const accountCode =
      typeof body?.account_code === "string"
        ? body.account_code.trim()
        : undefined;
    const accountName =
      typeof body?.account_name === "string"
        ? body.account_name.trim()
        : undefined;
    const accountType =
      typeof body?.account_type === "string"
        ? body.account_type.trim()
        : undefined;

    const parentAccountId =
      body?.parent_account_id !== undefined
        ? body.parent_account_id
          ? Number(body.parent_account_id)
          : null
        : undefined;

    const isActive =
      body?.is_active !== undefined ? Boolean(body.is_active) : undefined;

    if (accountType !== undefined && !ALLOWED_TYPES.has(accountType)) {
      return Response.json(
        {
          error:
            "account_type must be Asset, Liability, Income, Expense, or Equity",
        },
        { status: 400 },
      );
    }

    const next = {
      account_code:
        accountCode !== undefined ? accountCode : existing.account_code,
      account_name:
        accountName !== undefined ? accountName : existing.account_name,
      account_type:
        accountType !== undefined ? accountType : existing.account_type,
      parent_account_id:
        parentAccountId !== undefined
          ? parentAccountId
          : existing.parent_account_id,
      is_active: isActive !== undefined ? isActive : existing.is_active,
    };

    const rows = await sql`
      UPDATE chart_of_accounts
      SET account_code = ${next.account_code},
          account_name = ${next.account_name},
          account_type = ${next.account_type},
          parent_account_id = ${next.parent_account_id},
          is_active = ${next.is_active}
      WHERE id = ${accountId}
      RETURNING id, account_code, account_name, account_type, parent_account_id, is_active, created_at
    `;

    const account = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.account.update",
      entityType: "chart_of_accounts",
      entityId: accountId,
      oldValues: existing,
      newValues: account,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ account });
  } catch (error) {
    console.error("PUT /api/accounting/accounts/[id] error", error);
    return Response.json(
      { error: "Failed to update account" },
      { status: 500 },
    );
  }
}
