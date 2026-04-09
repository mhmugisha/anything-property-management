import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

const ALLOWED_TYPES = new Set([
  "Asset",
  "Liability",
  "Income",
  "Expense",
  "Equity",
]);

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const accounts = await sql`
      SELECT id, account_code, account_name, account_type, parent_account_id, is_active, created_at
      FROM chart_of_accounts
      ORDER BY account_code
    `;

    return Response.json({ accounts });
  } catch (error) {
    console.error("GET /api/accounting/accounts error", error);
    return Response.json(
      { error: "Failed to fetch accounts" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();
    const accountCode = (body?.account_code || "").trim();
    const accountName = (body?.account_name || "").trim();
    const accountType = (body?.account_type || "").trim();

    const parentAccountId = body?.parent_account_id
      ? Number(body.parent_account_id)
      : null;
    const isActive = body?.is_active === false ? false : true;

    if (!accountCode || !accountName || !accountType) {
      return Response.json(
        { error: "account_code, account_name, account_type are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(accountType)) {
      return Response.json(
        {
          error:
            "account_type must be Asset, Liability, Income, Expense, or Equity",
        },
        { status: 400 },
      );
    }

    const rows = await sql`
      INSERT INTO chart_of_accounts (
        account_code, account_name, account_type, parent_account_id, is_active
      )
      VALUES (
        ${accountCode}, ${accountName}, ${accountType}, ${parentAccountId}, ${isActive}
      )
      RETURNING id, account_code, account_name, account_type, parent_account_id, is_active, created_at
    `;

    const account = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.account.create",
      entityType: "chart_of_accounts",
      entityId: account?.id || null,
      oldValues: null,
      newValues: account,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ account });
  } catch (error) {
    console.error("POST /api/accounting/accounts error", error);

    const msg = String(error?.message || "");
    if (
      msg.toLowerCase().includes("unique") ||
      msg.toLowerCase().includes("duplicate")
    ) {
      return Response.json(
        { error: "Account code must be unique" },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
