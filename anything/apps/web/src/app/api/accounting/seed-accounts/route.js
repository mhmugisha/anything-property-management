import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

const SEED_ACCOUNTS = [
  // Assets
  { account_code: "1110", account_name: "Cash on Hand", account_type: "Asset" },
  {
    account_code: "1120",
    account_name: "Bank Account - Operating",
    account_type: "Asset",
  },
  {
    account_code: "1130",
    account_name: "Undeposited Funds",
    account_type: "Asset",
  },
  {
    account_code: "1210",
    account_name: "Accounts Receivable - Tenants",
    account_type: "Asset",
  },
  {
    account_code: "1300",
    account_name: "Tenant Deposits Held",
    account_type: "Asset",
  },
  {
    account_code: "1400",
    account_name: "Prepaid Expenses",
    account_type: "Asset",
  },

  // Liabilities
  {
    account_code: "2100",
    account_name: "Due to Landlords",
    account_type: "Liability",
  },
  {
    account_code: "2150",
    account_name: "Tenant Prepayments",
    account_type: "Liability",
  },
  {
    account_code: "2200",
    account_name: "Tenant Deposits Payable",
    account_type: "Liability",
  },
  {
    account_code: "2300",
    account_name: "Accounts Payable",
    account_type: "Liability",
  },
  {
    account_code: "2400",
    account_name: "Accrued Expenses",
    account_type: "Liability",
  },

  // Equity
  {
    account_code: "3100",
    account_name: "Owner's Equity",
    account_type: "Equity",
  },
  {
    account_code: "3200",
    account_name: "Retained Earnings",
    account_type: "Equity",
  },

  // Income
  {
    account_code: "4100",
    account_name: "Management Fee Income",
    account_type: "Income",
  },
  {
    account_code: "4200",
    account_name: "Rental Income",
    account_type: "Income",
  },
  {
    account_code: "4300",
    account_name: "Late Fee Income",
    account_type: "Income",
  },
  {
    account_code: "4400",
    account_name: "Other Income",
    account_type: "Income",
  },

  // Expenses
  {
    account_code: "5110",
    account_name: "Property Maintenance",
    account_type: "Expense",
  },
  {
    account_code: "5120",
    account_name: "Repairs & Maintenance",
    account_type: "Expense",
  },
  { account_code: "5130", account_name: "Utilities", account_type: "Expense" },
  {
    account_code: "5140",
    account_name: "Property Insurance",
    account_type: "Expense",
  },
  {
    account_code: "5150",
    account_name: "Property Taxes",
    account_type: "Expense",
  },
  {
    account_code: "5210",
    account_name: "Office Expenses",
    account_type: "Expense",
  },
  {
    account_code: "5220",
    account_name: "Professional Fees",
    account_type: "Expense",
  },
  {
    account_code: "5230",
    account_name: "Bank Charges",
    account_type: "Expense",
  },
  {
    account_code: "5240",
    account_name: "Software & Technology",
    account_type: "Expense",
  },
];

function uniqByCode(accounts) {
  const seen = new Set();
  const out = [];
  for (const a of accounts) {
    const code = String(a.account_code || "").trim();
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      account_code: code,
      account_name: String(a.account_name || "").trim(),
      account_type: String(a.account_type || "").trim(),
    });
  }
  return out;
}

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const rows = await sql(
      "SELECT COUNT(*)::int AS count FROM chart_of_accounts",
      [],
    );
    const count = Number(rows?.[0]?.count || 0);
    return Response.json({ ok: true, count });
  } catch (error) {
    console.error("GET /api/accounting/seed-accounts error", error);
    return Response.json(
      { error: "Failed to check accounts" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json().catch(() => ({}));
    const allowPartial = body?.allowPartial !== false; // default true

    const seedAccounts = uniqByCode(SEED_ACCOUNTS);

    if (!allowPartial) {
      const rows = await sql(
        "SELECT COUNT(*)::int AS count FROM chart_of_accounts",
        [],
      );
      const count = Number(rows?.[0]?.count || 0);
      if (count > 0) {
        return Response.json({ ok: true, insertedCount: 0, skipped: true });
      }
    }

    // Insert missing accounts only (non-destructive, idempotent).
    const values = [];
    const placeholders = seedAccounts
      .map((a, idx) => {
        const base = idx * 3;
        values.push(a.account_code, a.account_name, a.account_type);
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      })
      .join(", ");

    const insertSql = `
      INSERT INTO chart_of_accounts (account_code, account_name, account_type, is_active)
      SELECT v.account_code, v.account_name, v.account_type, true
      FROM (VALUES ${placeholders}) AS v(account_code, account_name, account_type)
      ON CONFLICT (account_code) DO NOTHING
      RETURNING id, account_code, account_name, account_type, is_active, created_at
    `;

    const inserted = await sql(insertSql, values);
    const insertedCount = Array.isArray(inserted) ? inserted.length : 0;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "accounting.accounts.seed",
      entityType: "chart_of_accounts",
      entityId: null,
      oldValues: null,
      newValues: {
        insertedCount,
        insertedCodes: (inserted || []).map((r) => r.account_code),
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      insertedCount,
      insertedAccounts: inserted,
    });
  } catch (error) {
    console.error("POST /api/accounting/seed-accounts error", error);
    return Response.json(
      { error: "Failed to seed chart of accounts" },
      { status: 500 },
    );
  }
}
