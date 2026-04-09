import sql from "@/app/api/utils/sql";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function getAccountById(accountId) {
  const id = toNumber(accountId);
  if (!id) return null;

  const rows = await sql`
    SELECT id, account_name, account_type, is_active
    FROM chart_of_accounts
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows?.[0] || null;
}

export async function getAccountIdByCode(accountCode) {
  if (!accountCode) return null;

  const rows = await sql`
    SELECT id
    FROM chart_of_accounts
    WHERE account_code = ${String(accountCode)}
    LIMIT 1
  `;

  return rows?.[0]?.id ? Number(rows[0].id) : null;
}

export async function getAccountCode(accountId) {
  const id = toNumber(accountId);
  if (!id) return null;

  const rows = await sql`
    SELECT account_code
    FROM chart_of_accounts
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows?.[0]?.account_code ? String(rows[0].account_code) : null;
}

export async function getAssetAccountBalance(accountId) {
  const id = toNumber(accountId);
  if (!id) return 0;

  const rows = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN debit_account_id = ${id} THEN amount ELSE 0 END), 0)
      -
      COALESCE(SUM(CASE WHEN credit_account_id = ${id} THEN amount ELSE 0 END), 0)
      AS balance
    FROM transactions
    WHERE (debit_account_id = ${id} OR credit_account_id = ${id})
      AND COALESCE(is_deleted,false) = false
  `;

  return Number(rows?.[0]?.balance || 0);
}

/**
 * Guard that prevents crediting (reducing) an Asset account below zero.
 * Returns an object you can use directly in API routes.
 *
 * EXCEPTION: Skips validation for Tenant Receivable (1210) since invoice
 * payment logic already prevents overpayment at the invoice level.
 */
export async function ensureCanCreditAccount({ creditAccountId, amount } = {}) {
  const acctId = toNumber(creditAccountId);
  const amt = toNumber(amount);

  if (!acctId || !amt) {
    return { ok: true };
  }

  const account = await getAccountById(acctId);
  if (!account) {
    return { ok: false, status: 400, body: { error: "Invalid account" } };
  }

  // Only enforce for Asset accounts (cash/bank + any future assets).
  if ((account.account_type || "").trim() !== "Asset") {
    return { ok: true, account };
  }

  // EXCEPTION: Skip balance check for Tenant Receivable (1210)
  // Invoice payments already have overpayment protection at the invoice level.
  // This prevents false "Insufficient funds" errors when accrual entries
  // haven't been synced yet.
  const accountCode = await getAccountCode(acctId);
  if (accountCode === "1210") {
    return { ok: true, account };
  }

  const available = await getAssetAccountBalance(acctId);
  if (amt > available) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Insufficient funds",
        available,
      },
    };
  }

  return { ok: true, account, available };
}

/**
 * Computes how much is currently owed to landlords.
 *
 * IMPORTANT: This now computes from the SOURCE data (invoices, payouts,
 * deductions) rather than from the transactions ledger.  The transactions
 * ledger may not always be in sync (e.g. invoices created before the
 * accounting integration was set up), so using source data ensures the
 * guard matches the balance the user sees on the landlord property statement.
 *
 * Formula:
 *   due = SUM(invoice amounts − management fees)  − SUM(payouts) − SUM(deductions)
 *
 * Management fees are computed per (property, year, month) group using
 * the property's management_fee_type / percent / fixed_amount settings.
 */
export async function getDueToLandlordsBalance({
  landlordId,
  propertyId,
  excludePayoutId,
  excludeDeductionId,
} = {}) {
  const lId = toNumber(landlordId);
  const pId = toNumber(propertyId);
  const exPayoutId = toNumber(excludePayoutId);
  const exDedId = toNumber(excludeDeductionId);

  if (!lId || !pId) return 0;

  // 1. Get property management fee settings
  const propRows = await sql(
    "SELECT management_fee_type, management_fee_percent, management_fee_fixed_amount FROM properties WHERE id = $1 LIMIT 1",
    [pId],
  );
  const prop = propRows?.[0] || {};
  const feeType = String(prop.management_fee_type || "percent").toLowerCase();
  const feePercent = Number(prop.management_fee_percent || 0);
  const feeFixed = Number(prop.management_fee_fixed_amount || 0);

  // 2. Get all invoices grouped by (year, month) for management fee calculation
  const invoiceGroups = await sql(
    `SELECT i.invoice_year, i.invoice_month,
            COALESCE(SUM(i.amount), 0)::numeric AS gross_rent
     FROM invoices i
     WHERE i.property_id = $1
       AND i.status <> 'void'
       AND COALESCE(i.is_deleted, false) = false
     GROUP BY i.invoice_year, i.invoice_month`,
    [pId],
  );

  // 3. Compute net credits (gross rent minus management fees per month)
  let totalCredits = 0;
  for (const g of invoiceGroups || []) {
    const gross = Number(g.gross_rent || 0);
    let fee = 0;
    if (gross > 0) {
      if (feeType === "percent") {
        fee = Math.round(((gross * feePercent) / 100) * 100) / 100;
      } else if (feeType === "fixed") {
        fee = Math.min(feeFixed, gross);
      }
    }
    totalCredits += gross - fee;
  }

  // 4. Get total payouts (optionally excluding one)
  let payoutQuery = `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM landlord_payouts
     WHERE landlord_id = $1
       AND property_id = $2
       AND COALESCE(is_deleted, false) = false`;
  const payoutValues = [lId, pId];

  if (exPayoutId) {
    payoutQuery += ` AND id <> $${payoutValues.length + 1}`;
    payoutValues.push(exPayoutId);
  }

  const payoutRows = await sql(payoutQuery, payoutValues);
  const totalPayouts = Number(payoutRows?.[0]?.total || 0);

  // 5. Get total deductions (optionally excluding one)
  let dedQuery = `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM landlord_deductions
     WHERE landlord_id = $1
       AND property_id = $2
       AND COALESCE(is_deleted, false) = false`;
  const dedValues = [lId, pId];

  if (exDedId) {
    dedQuery += ` AND id <> $${dedValues.length + 1}`;
    dedValues.push(exDedId);
  }

  const dedRows = await sql(dedQuery, dedValues);
  const totalDeductions = Number(dedRows?.[0]?.total || 0);

  // 6. due = credits − payouts − deductions
  return totalCredits - totalPayouts - totalDeductions;
}
