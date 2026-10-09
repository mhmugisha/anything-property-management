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

/**
 * Sum of debits booked to an Expense account in a given calendar month.
 *
 * Deliberately wider than the P&L: counts both approved and pending entries,
 * so budget guards (Phase 3) see committed spend even before admin approval.
 * Still excludes soft-deleted rows (the standard reversal mechanism).
 *
 * @param {number|string} accountId
 * @param {string|Date} periodMonth - any date in the target month; truncated to month
 * @param {{ excludeTransactionId?: number|string|null }} [options]
 *   excludeTransactionId - leave one row out of the sum (used by the budget
 *   gate when editing an entry, so it isn't counted against itself)
 * @returns {Promise<number>}
 */
export async function getExpenseCommitted(
  accountId,
  periodMonth,
  { excludeTransactionId = null } = {},
) {
  const id = toNumber(accountId);
  if (!id || !periodMonth) return 0;
  const excludeId = toNumber(excludeTransactionId);

  const rows = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE debit_account_id = ${id}
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(approval_status, 'approved') IN ('approved', 'pending')
      AND date_trunc('month', transaction_date) = date_trunc('month', ${periodMonth}::date)
      AND (${excludeId}::int IS NULL OR id <> ${excludeId}::int)
  `;

  return Number(rows?.[0]?.total || 0);
}

/**
 * Hard stop for manual postings that touch an account flagged
 * manual_posting_locked (e.g. 5160, which only Payroll may post to).
 * No override. Callers must only use this for source_type='manual' postings.
 */
export async function ensureNotManuallyLocked({
  debitAccountId,
  creditAccountId,
} = {}) {
  const ids = [toNumber(debitAccountId), toNumber(creditAccountId)].filter(
    Boolean,
  );
  if (ids.length === 0) return { ok: true };

  const rows = await sql`
    SELECT account_code, account_name
    FROM chart_of_accounts
    WHERE id = ANY(${ids}::int[])
      AND manual_posting_locked = true
    ORDER BY account_code
    LIMIT 1
  `;
  const locked = rows?.[0];
  if (!locked) return { ok: true };

  const error =
    String(locked.account_code) === "5160"
      ? "Salary payments are made through the Payroll feature — this account can’t be journaled manually."
      : "This account is managed automatically and can’t receive manual journal entries.";

  return {
    ok: false,
    status: 422,
    body: {
      error,
      locked_account: true,
      account_code: locked.account_code,
      account_name: locked.account_name,
    },
  };
}

/**
 * Budget gate for debits to an Expense account.
 *
 * Non-Expense accounts and unbudgeted (account, month) pairs are always
 * allowed. Otherwise the posting is blocked when committed spend for the
 * month plus this amount would exceed the budget line.
 *
 * @returns {Promise<{ allowed: boolean, month?: string, budget?: number,
 *   committed?: number, overage?: number, account_name?: string }>}
 */
export async function enforceExpenseBudget({
  accountId,
  amount,
  date,
  excludeTransactionId = null,
} = {}) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    throw new Error("enforceExpenseBudget: amount must be a number >= 0");
  }

  const account = await getAccountById(accountId);
  if (!account || (account.account_type || "").trim() !== "Expense") {
    return { allowed: true };
  }

  const budgetRows = await sql`
    SELECT to_char(date_trunc('month', ${date}::date), 'YYYY-MM-DD') AS month,
           b.amount AS budget
    FROM (SELECT 1) AS one
    LEFT JOIN operating_budget_lines b
      ON b.account_id = ${account.id}
     AND b.period_month = date_trunc('month', ${date}::date)::date
  `;
  const month = budgetRows?.[0]?.month;
  const budgetRaw = budgetRows?.[0]?.budget;
  if (budgetRaw === null || budgetRaw === undefined) {
    return { allowed: true };
  }

  const budget = Number(budgetRaw);
  const committed = await getExpenseCommitted(account.id, month, {
    excludeTransactionId,
  });

  const result = {
    month,
    budget,
    committed,
    account_name: account.account_name,
  };

  if (committed + amt > budget) {
    return { ...result, allowed: false, overage: committed + amt - budget };
  }
  return { ...result, allowed: true, overage: 0 };
}

function formatBudgetMonth(month) {
  const d = new Date(`${month}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Runs the expense budget gate for a manual journal posting and applies the
 * override rules: a blocked posting may proceed only if the caller is an
 * Admin and supplied budget_override=true with a non-empty
 * budget_override_reason.
 *
 * Returns { ok: false, status, body } to send as-is, or { ok: true, override }
 * where override is null or the details to record in the audit log after the
 * row is written.
 */
export async function checkExpenseBudgetForPosting({
  staff,
  body,
  accountId,
  amount,
  date,
  excludeTransactionId = null,
}) {
  const gate = await enforceExpenseBudget({
    accountId,
    amount,
    date,
    excludeTransactionId,
  });
  if (gate.allowed) return { ok: true, override: null };

  if (body?.budget_override !== true) {
    const overageText = `UGX ${Number(gate.overage).toLocaleString("en-US")}`;
    return {
      ok: false,
      status: 409,
      body: {
        error: `Posting this would exceed ${gate.account_name} ${formatBudgetMonth(gate.month)} budget by ${overageText}.`,
        account_name: gate.account_name,
        month: gate.month,
        budget: gate.budget,
        committed: gate.committed,
        overage: gate.overage,
      },
    };
  }

  if (staff?.role_name !== "Admin") {
    return {
      ok: false,
      status: 403,
      body: { error: "Only an Admin can override the budget." },
    };
  }

  const reason = String(body?.budget_override_reason || "").trim();
  if (!reason) {
    return {
      ok: false,
      status: 400,
      body: { error: "A reason is required to override the budget." },
    };
  }

  return {
    ok: true,
    override: {
      account_id: Number(accountId),
      month: gate.month,
      amount: Number(amount),
      overage: gate.overage,
      reason,
      by: staff.id,
    },
  };
}

/**
 * Security deposit still held for a lease (account 2200): deposits and
 * adjustments for the lease, minus any refund/forfeiture already posted at
 * termination. A lease that has been settled therefore reads 0.
 */
export async function getLeaseDepositBalance(leaseId) {
  const id = toNumber(leaseId);
  if (!id) return 0;
  const acctId = await getAccountIdByCode("2200");
  if (!acctId) return 0;

  const rows = await sql(
    `SELECT
       COALESCE(SUM(CASE WHEN credit_account_id = $1 THEN amount ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN debit_account_id = $1 THEN amount ELSE 0 END), 0)
       AS balance
     FROM transactions
     WHERE (debit_account_id = $1 OR credit_account_id = $1)
       AND source_id = $2
       AND source_type IN ('security_deposit', 'security_deposit_adjustment',
                           'security_deposit_refund', 'security_deposit_forfeiture')
       AND COALESCE(is_deleted, false) = false`,
    [acctId, id],
  );
  return Number(rows?.[0]?.balance || 0);
}

/**
 * Tenant prepayment balance (account 2150), tenant-wide: advances recorded
 * against the tenant's payments, minus refunds/write-offs posted when any of
 * the tenant's leases ended (those rows carry source_id = lease id).
 */
export async function getTenantPrepaymentBalance(tenantId) {
  const id = toNumber(tenantId);
  if (!id) return 0;
  const acctId = await getAccountIdByCode("2150");
  if (!acctId) return 0;

  const rows = await sql(
    `SELECT
       COALESCE(SUM(CASE WHEN t.credit_account_id = $1 THEN t.amount ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN t.debit_account_id = $1 THEN t.amount ELSE 0 END), 0)
       AS balance
     FROM transactions t
     WHERE (t.debit_account_id = $1 OR t.credit_account_id = $1)
       AND COALESCE(t.is_deleted, false) = false
       AND (
         (t.source_type IN ('payment_advance', 'payment_auto_apply')
          AND t.source_id IN (SELECT id FROM payments WHERE tenant_id = $2))
         OR
         (t.source_type IN ('prepayment_refund', 'prepayment_writeoff')
          AND t.source_id IN (SELECT id FROM leases WHERE tenant_id = $2))
       )`,
    [acctId, id],
  );
  return Number(rows?.[0]?.balance || 0);
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

export function managementFeeSettings(prop) {
  return {
    feeType: String(prop?.management_fee_type || "percent").toLowerCase(),
    feePercent: Number(prop?.management_fee_percent || 0),
    feeFixed: Number(prop?.management_fee_fixed_amount || 0),
  };
}

// Management fee for one (property, year, month) invoice group. Canonical:
// the landlord statement uses this too, so both show the same balance.
export function monthlyManagementFee(gross, { feeType, feePercent, feeFixed }) {
  if (gross <= 0) return 0;
  if (feeType === "percent") {
    return Math.round(((gross * feePercent) / 100) * 100) / 100;
  }
  if (feeType === "fixed") return Math.min(feeFixed, gross);
  return 0;
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
 *         − SUM(landlord-charged maintenance) + SUM(balance adjustments)
 *
 * Management fees are computed per (property, year, month) group using
 * the property's management_fee_type / percent / fixed_amount settings.
 *
 * Landlord-charged maintenance is read from maintenance_requests (the same
 * rule as the landlord statement), never from landlord_deductions, so it is
 * subtracted exactly once.
 *
 * Balance adjustments (landlord_balance_adjustments) are signed: a positive
 * amount increases due, a negative one decreases it.
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
  const fees = managementFeeSettings(propRows?.[0] || {});

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
    totalCredits += gross - monthlyManagementFee(gross, fees);
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

  // 6. Landlord-charged maintenance on this property
  const maintRows = await sql(
    `SELECT COALESCE(SUM(completed_cost), 0)::numeric AS total
     FROM maintenance_requests
     WHERE property_id = $1
       AND status IN ('completed', 'closed')
       AND charge_type = 'landlord'
       AND completed_cost IS NOT NULL`,
    [pId],
  );
  const totalMaintenance = Number(maintRows?.[0]?.total || 0);

  // 7. Signed balance adjustments for this landlord + property
  const adjRows = await sql(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM landlord_balance_adjustments
     WHERE landlord_id = $1
       AND property_id = $2
       AND COALESCE(is_deleted, false) = false`,
    [lId, pId],
  );
  const totalAdjustments = Number(adjRows?.[0]?.total || 0);

  // 8. due = credits − payouts − deductions − maintenance + adjustments
  return (
    totalCredits -
    totalPayouts -
    totalDeductions -
    totalMaintenance +
    totalAdjustments
  );
}

/**
 * getDueToLandlordsBalance for every property against its current landlord,
 * in six queries instead of one call per property. Same formula and fee
 * logic; the sum of the rows is the grand total due to landlords.
 *
 * @returns {Promise<Array<{ landlordId: number, propertyId: number, due: number }>>}
 */
export async function getDueToLandlordsByProperty() {
  const [propRows, invoiceGroups, payoutRows, dedRows, maintRows, adjRows] =
    await Promise.all([
      sql(
        `SELECT id, landlord_id, management_fee_type, management_fee_percent,
              management_fee_fixed_amount
       FROM properties
       WHERE landlord_id IS NOT NULL`,
      ),
      sql(
        `SELECT i.property_id,
              COALESCE(SUM(i.amount), 0)::numeric AS gross_rent
       FROM invoices i
       WHERE i.property_id IS NOT NULL
         AND i.status <> 'void'
         AND COALESCE(i.is_deleted, false) = false
       GROUP BY i.property_id, i.invoice_year, i.invoice_month`,
      ),
      sql(
        `SELECT landlord_id, property_id, COALESCE(SUM(amount), 0)::numeric AS total
       FROM landlord_payouts
       WHERE COALESCE(is_deleted, false) = false
       GROUP BY landlord_id, property_id`,
      ),
      sql(
        `SELECT landlord_id, property_id, COALESCE(SUM(amount), 0)::numeric AS total
       FROM landlord_deductions
       WHERE COALESCE(is_deleted, false) = false
       GROUP BY landlord_id, property_id`,
      ),
      sql(
        `SELECT property_id, COALESCE(SUM(completed_cost), 0)::numeric AS total
       FROM maintenance_requests
       WHERE property_id IS NOT NULL
         AND status IN ('completed', 'closed')
         AND charge_type = 'landlord'
         AND completed_cost IS NOT NULL
       GROUP BY property_id`,
      ),
      sql(
        `SELECT landlord_id, property_id, COALESCE(SUM(amount), 0)::numeric AS total
       FROM landlord_balance_adjustments
       WHERE COALESCE(is_deleted, false) = false
       GROUP BY landlord_id, property_id`,
      ),
    ]);

  const key = (l, p) => `${Number(l)}:${Number(p)}`;
  const sumBy = (rows) => {
    const m = new Map();
    for (const r of rows || []) {
      m.set(key(r.landlord_id, r.property_id), Number(r.total || 0));
    }
    return m;
  };
  const payouts = sumBy(payoutRows);
  const deductions = sumBy(dedRows);
  const adjustments = sumBy(adjRows);
  const maintenance = new Map(
    (maintRows || []).map((r) => [Number(r.property_id), Number(r.total || 0)]),
  );

  const groupsByProperty = new Map();
  for (const g of invoiceGroups || []) {
    const pid = Number(g.property_id);
    if (!groupsByProperty.has(pid)) groupsByProperty.set(pid, []);
    groupsByProperty.get(pid).push(Number(g.gross_rent || 0));
  }

  return (propRows || []).map((prop) => {
    const landlordId = Number(prop.landlord_id);
    const propertyId = Number(prop.id);
    const fees = managementFeeSettings(prop);
    let credits = 0;
    for (const gross of groupsByProperty.get(propertyId) || []) {
      credits += gross - monthlyManagementFee(gross, fees);
    }
    const k = key(landlordId, propertyId);
    const due =
      credits -
      (payouts.get(k) || 0) -
      (deductions.get(k) || 0) -
      (maintenance.get(propertyId) || 0) +
      (adjustments.get(k) || 0);
    return { landlordId, propertyId, due };
  });
}

/** Grand total due to landlords (source-table math, all properties). */
export async function getTotalDueToLandlords() {
  const rows = await getDueToLandlordsByProperty();
  return rows.reduce((sum, r) => sum + r.due, 0);
}
