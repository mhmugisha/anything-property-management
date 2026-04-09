import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

async function getAccountIdsByCodes(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return {};
  const rows = await sql(
    "SELECT account_code, id FROM chart_of_accounts WHERE account_code = ANY($1)",
    [codes],
  );
  const map = {};
  for (const r of rows || []) {
    map[String(r.account_code)] = Number(r.id);
  }
  return map;
}

async function getAccountBalancesByIds(accountIds) {
  const ids = (accountIds || []).filter(Boolean);
  if (ids.length === 0) return {};

  const rows = await sql(
    `
      SELECT account_id, SUM(amount)::numeric AS balance
      FROM (
        SELECT debit_account_id AS account_id, amount
        FROM transactions
        WHERE debit_account_id = ANY($1)
          AND COALESCE(is_deleted,false) = false
        UNION ALL
        SELECT credit_account_id AS account_id, -amount
        FROM transactions
        WHERE credit_account_id = ANY($1)
          AND COALESCE(is_deleted,false) = false
      ) t
      GROUP BY account_id
    `,
    [ids],
  );

  const map = {};
  for (const r of rows || []) {
    map[String(r.account_id)] = Number(r.balance || 0);
  }
  return map;
}

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

// CRITICAL FIX: Calculate amount due to landlords from invoices, payouts, and deductions
// This is the SAME calculation used by the Consolidated Balances Due report
async function calculateAmountDueToLandlords() {
  const landlords = await sql`
    SELECT id
    FROM landlords
    ORDER BY id
  `;

  let totalDue = 0;

  for (const landlord of landlords || []) {
    const llId = landlord.id;

    const properties = await sql`
      SELECT id, 
             management_fee_type, management_fee_percent, management_fee_fixed_amount
      FROM properties
      WHERE landlord_id = ${llId}
    `;

    let rentTotal = 0;
    let managementFeesTotal = 0;
    let otherDeductionsTotal = 0;
    let reversalsTotal = 0;

    for (const property of properties || []) {
      const propertyId = property.id;

      const invoices = await sql`
        SELECT i.invoice_year, i.invoice_month, i.amount, COALESCE(i.currency,'UGX') AS currency
        FROM invoices i
        WHERE i.property_id = ${propertyId}
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
      `;

      const propertyRent = (invoices || []).reduce((sum, inv) => {
        return sum + Number(inv.amount || 0);
      }, 0);
      rentTotal += propertyRent;

      const feeType = String(
        property.management_fee_type || "percent",
      ).toLowerCase();
      const percent = Number(property.management_fee_percent || 0);
      const fixedAmount = Number(property.management_fee_fixed_amount || 0);

      const monthGroups = new Map();
      for (const inv of invoices || []) {
        const key = `${inv.invoice_year}-${inv.invoice_month}`;
        const prev = monthGroups.get(key) || [];
        prev.push(inv);
        monthGroups.set(key, prev);
      }

      for (const monthInvoices of monthGroups.values()) {
        const gross = monthInvoices.reduce(
          (sum, r) => sum + Number(r.amount || 0),
          0,
        );

        let feeForMonth = 0;
        if (feeType === "percent") {
          feeForMonth = round2((gross * percent) / 100);
        } else if (feeType === "fixed") {
          feeForMonth = Math.min(fixedAmount, gross);
        }
        managementFeesTotal += feeForMonth;
      }

      const deductions = await sql`
        SELECT COALESCE(SUM(amount), 0) AS deduction_total
        FROM landlord_deductions
        WHERE landlord_id = ${llId}
          AND property_id = ${propertyId}
          AND COALESCE(is_deleted, false) = false
      `;

      otherDeductionsTotal += Number(deductions?.[0]?.deduction_total || 0);

      // Get reversals for this property (rent_reversal only)
      const reversals = await sql`
        SELECT COALESCE(SUM(amount), 0) AS reversal_total
        FROM transactions
        WHERE property_id = ${propertyId}
          AND source_type = 'rent_reversal'
          AND COALESCE(is_deleted, false) = false
      `;

      reversalsTotal += Number(reversals?.[0]?.reversal_total || 0);
    }

    // Get landlord payouts
    const payouts = await sql`
      SELECT COALESCE(SUM(amount), 0) AS payout_total
      FROM landlord_payouts
      WHERE landlord_id = ${llId}
        AND COALESCE(is_deleted, false) = false
    `;

    const totalPayouts = Number(payouts?.[0]?.payout_total || 0);

    // CRITICAL: Match Consolidated Balances Due and Landlord Statement
    // Balance = Rent - Management Fees - Deductions - Reversals - Payouts
    const totalDeductions = managementFeesTotal + otherDeductionsTotal;
    const balanceDue =
      rentTotal - totalDeductions - reversalsTotal - totalPayouts;

    totalDue += balanceDue;
  }

  return totalDue;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYmdString(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function lastDayOfMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function computeNextDueDateYmd(dueDay, now = new Date()) {
  if (!dueDay || Number.isNaN(Number(dueDay))) return null;
  const due = Number(dueDay);
  if (due < 1 || due > 31) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const year = today.getFullYear();
  const monthIndex0 = today.getMonth();

  const lastDayThisMonth = lastDayOfMonth(year, monthIndex0);
  const dayThisMonth = Math.min(due, lastDayThisMonth);
  const candidateThisMonth = new Date(year, monthIndex0, dayThisMonth);
  candidateThisMonth.setHours(0, 0, 0, 0);

  if (candidateThisMonth >= today) {
    return toYmdString(candidateThisMonth);
  }

  const nextMonth = new Date(year, monthIndex0 + 1, 1);
  const nextYear = nextMonth.getFullYear();
  const nextMonthIndex0 = nextMonth.getMonth();

  const lastDayNextMonth = lastDayOfMonth(nextYear, nextMonthIndex0);
  const dayNextMonth = Math.min(due, lastDayNextMonth);
  const candidateNextMonth = new Date(nextYear, nextMonthIndex0, dayNextMonth);
  candidateNextMonth.setHours(0, 0, 0, 0);

  return toYmdString(candidateNextMonth);
}

function monthLabelShort(year, month1) {
  const d = new Date(year, month1 - 1, 1);
  return d.toLocaleDateString("en-UG", { month: "short" });
}

function addMonths(dateObj, deltaMonths) {
  const d = new Date(dateObj);
  d.setDate(1);
  d.setMonth(d.getMonth() + deltaMonths);
  return d;
}

export async function GET(request) {
  const perm = await requirePermission(request, "dashboard");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    // OPTIMIZATION: Removed blocking invoice generation - now runs as scheduled job

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const monthStart = new Date(currentYear, currentMonth - 1, 1)
      .toISOString()
      .slice(0, 10);
    const todayYmd = toYmdString(currentDate);
    const seriesStartYmd = toYmdString(
      addMonths(new Date(currentYear, currentMonth - 1, 1), -5),
    );

    // OPTIMIZATION: Run all independent queries in parallel
    const [
      totalRentRows,
      collectedRows,
      outstandingRows,
      arrearsNotPaidInIssueMonthRows,
      arrearsRows,
      activeTenantsRows,
      activeLandlordsRows,
      portfolioRows,
      mgmtFeeRows,
      incomeSeriesRows,
      expenseSeriesRows,
      incomeRows,
      expenseRows,
      landlordRows,
    ] = await Promise.all([
      // Total rent billed (current month invoices)
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM invoices
        WHERE invoice_month = ${currentMonth}
          AND invoice_year = ${currentYear}
          AND status <> 'void'
          AND COALESCE(is_deleted, false) = false
      `,

      // Rent collected for current month
      sql`
        SELECT COALESCE(SUM(pia.amount_applied), 0) AS total
        FROM payment_invoice_allocations pia
        JOIN invoices i ON i.id = pia.invoice_id
        JOIN payments p ON p.id = pia.payment_id
        WHERE i.invoice_month = ${currentMonth}
          AND i.invoice_year = ${currentYear}
          AND COALESCE(i.is_deleted, false) = false
          AND p.is_reversed = false
      `,

      // Outstanding rent (all open invoices)
      sql`
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS total
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
      `,

      // Arrears (not paid in issue month)
      sql`
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS total
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND (
            i.invoice_year < ${currentYear}
            OR (i.invoice_year = ${currentYear} AND i.invoice_month < ${currentMonth})
          )
      `,

      // Legacy arrears calculation
      sql`
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS total
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND i.due_date < ${monthStart}::date
      `,

      // Active tenants count
      sql`
        SELECT COUNT(*)::int AS count
        FROM tenants
        WHERE COALESCE(status, 'active') = 'active'
      `,

      // Active landlords count
      sql`
        SELECT COUNT(*)::int AS count
        FROM landlords
        WHERE COALESCE(status, 'active') = 'active'
      `,

      // Portfolio (total monthly rent for active leases)
      sql`
        SELECT COALESCE(SUM(monthly_rent), 0) AS total
        FROM leases
        WHERE status = 'active'
      `,

      // Management fees (this month)
      sql`
        WITH by_property AS (
          SELECT
            i.property_id,
            SUM(i.amount)::numeric(15,2) AS gross,
            MAX(COALESCE(p.management_fee_percent, 0))::numeric(5,2) AS fee_percent,
            MAX(COALESCE(p.management_fee_fixed_amount, 0))::numeric(15,2) AS fixed_amount,
            MAX(COALESCE(p.management_fee_type, 'percent'))::text AS fee_type
          FROM invoices i
          JOIN properties p ON p.id = i.property_id
          WHERE i.invoice_month = ${currentMonth}
            AND i.invoice_year = ${currentYear}
            AND i.status <> 'void'
            AND COALESCE(i.is_deleted, false) = false
          GROUP BY i.property_id
        )
        SELECT COALESCE(
          SUM(
            CASE
              WHEN fee_type = 'percent' THEN ROUND((gross * fee_percent / 100.0)::numeric, 2)
              WHEN fee_type = 'fixed' THEN LEAST(fixed_amount, gross)
              ELSE 0
            END
          ),
          0
        ) AS total
        FROM by_property
      `,

      // Income series (last 6 months)
      sql`
        SELECT
          EXTRACT(year FROM t.transaction_date)::int AS year,
          EXTRACT(month FROM t.transaction_date)::int AS month,
          COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        JOIN chart_of_accounts a ON a.id = t.credit_account_id
        WHERE a.account_type = 'Income'
          AND COALESCE(t.is_deleted,false) = false
          AND t.transaction_date >= ${seriesStartYmd}::date
        GROUP BY year, month
      `,

      // Expense series (last 6 months)
      sql`
        SELECT
          EXTRACT(year FROM t.transaction_date)::int AS year,
          EXTRACT(month FROM t.transaction_date)::int AS month,
          COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        JOIN chart_of_accounts a ON a.id = t.debit_account_id
        WHERE a.account_type = 'Expense'
          AND COALESCE(t.is_deleted,false) = false
          AND t.transaction_date >= ${seriesStartYmd}::date
        GROUP BY year, month
      `,

      // Income this month
      sql`
        SELECT COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        JOIN chart_of_accounts a ON a.id = t.credit_account_id
        WHERE a.account_type = 'Income'
          AND COALESCE(t.is_deleted,false) = false
          AND t.transaction_date >= ${monthStart}::date
          AND t.transaction_date <= ${todayYmd}::date
      `,

      // Expenses this month
      sql`
        SELECT COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        JOIN chart_of_accounts a ON a.id = t.debit_account_id
        WHERE a.account_type = 'Expense'
          AND COALESCE(t.is_deleted,false) = false
          AND t.transaction_date >= ${monthStart}::date
          AND t.transaction_date <= ${todayYmd}::date
      `,

      // Landlord balances
      sql`
        SELECT
          l.id,
          l.title,
          l.full_name,
          (CASE WHEN l.due_date IS NULL THEN NULL ELSE EXTRACT(day FROM l.due_date)::int END) AS due_day,
          (
            COALESCE(inv.total, 0)
            - COALESCE(payouts.total, 0)
            - COALESCE(deds.total, 0)
          ) AS balance
        FROM landlords l
        LEFT JOIN LATERAL (
          WITH by_prop_month AS (
            SELECT
              i.property_id,
              i.invoice_year,
              i.invoice_month,
              SUM(i.amount)::numeric(15,2) AS gross,
              MAX(COALESCE(p.management_fee_percent, 0))::numeric(5,2) AS fee_percent,
              MAX(COALESCE(p.management_fee_fixed_amount, 0))::numeric(15,2) AS fixed_amount,
              MAX(COALESCE(p.management_fee_type, 'percent'))::text AS fee_type
            FROM invoices i
            JOIN properties p ON p.id = i.property_id
            WHERE p.landlord_id = l.id
              AND i.status <> 'void'
              AND COALESCE(i.is_deleted, false) = false
            GROUP BY i.property_id, i.invoice_year, i.invoice_month
          ),
          by_prop_month_with_fee AS (
            SELECT
              bpm.*,
              CASE
                WHEN bpm.fee_type = 'percent' THEN
                  ROUND((bpm.gross * bpm.fee_percent / 100.0)::numeric, 2)
                WHEN bpm.fee_type = 'fixed' THEN
                  LEAST(bpm.fixed_amount, bpm.gross)
                ELSE 0
              END::numeric(15,2) AS fee_amount
            FROM by_prop_month bpm
          )
          SELECT COALESCE(
            SUM(
              gross - fee_amount
            ),
            0
          ) AS total
          FROM by_prop_month_with_fee
        ) inv ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(lp.amount), 0) AS total
          FROM landlord_payouts lp
          WHERE lp.landlord_id = l.id
            AND COALESCE(lp.is_deleted,false) = false
        ) payouts ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ld.amount), 0) AS total
          FROM landlord_deductions ld
          WHERE ld.landlord_id = l.id
            AND COALESCE(ld.is_deleted,false) = false
        ) deds ON true
        ORDER BY l.full_name ASC
        LIMIT 200
      `,
    ]);

    // Extract values from query results
    const totalRent = Number(totalRentRows?.[0]?.total || 0);
    const rentCollected = Number(collectedRows?.[0]?.total || 0);
    const outstandingRent = Number(outstandingRows?.[0]?.total || 0);
    const arrearsNotPaidInIssueMonth = Number(
      arrearsNotPaidInIssueMonthRows?.[0]?.total || 0,
    );
    const totalArrears = Number(arrearsRows?.[0]?.total || 0);
    const activeTenantsCount = Number(activeTenantsRows?.[0]?.count || 0);
    const activeLandlordsCount = Number(activeLandlordsRows?.[0]?.count || 0);
    const portfolio = Number(portfolioRows?.[0]?.total || 0);
    const managementFeesThisMonth = Number(mgmtFeeRows?.[0]?.total || 0);
    const totalIncome = Number(incomeRows?.[0]?.total || 0);
    const totalExpenses = Number(expenseRows?.[0]?.total || 0);
    const netProfit = totalIncome - totalExpenses;

    // Fetch account balances in parallel
    const codeToId = await getAccountIdsByCodes([
      "1110",
      "1120",
      "1130",
      "2100",
      "5160",
      "5210",
    ]);

    const cashId = codeToId["1110"] || null;
    const bankId = codeToId["1120"] || null;
    const undepositedFundsId = codeToId["1130"] || null;
    const rentPayableId = codeToId["2100"] || null;
    const salariesId = codeToId["5160"] || null;
    const officeExpensesId = codeToId["5210"] || null;

    const [balances, salaryOfficeExpensesThisMonth] = await Promise.all([
      getAccountBalancesByIds([
        cashId,
        bankId,
        undepositedFundsId,
        rentPayableId,
      ]),

      // Salary + Office Expenses (this month)
      (async () => {
        const expenseIds = [salariesId, officeExpensesId].filter(Boolean);
        if (expenseIds.length === 0) return 0;

        const expRows = await sql(
          `
            SELECT COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            WHERE COALESCE(t.is_deleted,false) = false
              AND t.transaction_date >= $1::date
              AND t.transaction_date <= $2::date
              AND t.debit_account_id = ANY($3)
          `,
          [monthStart, todayYmd, expenseIds],
        );
        return Number(expRows?.[0]?.total || 0);
      })(),
    ]);

    const cashBalance = Number(balances[String(cashId)] || 0);
    const bankBalance = Number(balances[String(bankId)] || 0);
    const undepositedFundsBalance = Number(
      balances[String(undepositedFundsId)] || 0,
    );

    // CRITICAL FIX: Calculate amount due to landlords from invoices/payouts/deductions
    // This matches the Consolidated Balances Due report calculation
    const amountDueToLandlords = await calculateAmountDueToLandlords();

    // Build P&L series from results
    const incomeMap = {};
    for (const r of incomeSeriesRows || []) {
      const key = `${Number(r.year)}-${String(r.month).padStart(2, "0")}`;
      incomeMap[key] = Number(r.total || 0);
    }

    const expenseMap = {};
    for (const r of expenseSeriesRows || []) {
      const key = `${Number(r.year)}-${String(r.month).padStart(2, "0")}`;
      expenseMap[key] = Number(r.total || 0);
    }

    const plSeries = [];
    for (let i = 5; i >= 0; i--) {
      const d = addMonths(new Date(currentYear, currentMonth - 1, 1), -i);
      const y = d.getFullYear();
      const m1 = d.getMonth() + 1;
      const key = `${y}-${String(m1).padStart(2, "0")}`;
      plSeries.push({
        key,
        label: `${monthLabelShort(y, m1)} ${String(y).slice(-2)}`,
        income: Number(incomeMap[key] || 0),
        expenses: Number(expenseMap[key] || 0),
      });
    }

    // Process landlord balances
    const landlordBalances = (landlordRows || [])
      .map((l) => {
        const dueDay = l?.due_day ? Number(l.due_day) : null;
        const nextDueYmd = computeNextDueDateYmd(dueDay, currentDate);
        return {
          ...l,
          due_day: dueDay,
          next_due_date: nextDueYmd,
          balance: Number(l?.balance || 0),
        };
      })
      .sort((a, b) => {
        const ad = a.next_due_date;
        const bd = b.next_due_date;
        if (!ad && !bd)
          return String(a.full_name || "").localeCompare(
            String(b.full_name || ""),
          );
        if (!ad) return 1;
        if (!bd) return -1;
        if (ad < bd) return -1;
        if (ad > bd) return 1;
        return String(a.full_name || "").localeCompare(
          String(b.full_name || ""),
        );
      })
      .slice(0, 50);

    return Response.json({
      stats: {
        activeTenantsCount,
        activeLandlordsCount,
        managementFeesThisMonth,
        amountDueToLandlords: Number(amountDueToLandlords || 0), // CRITICAL FIX: Now calculated from invoices/payouts/deductions
        arrearsNotPaidInIssueMonth,
        totalRent,
        rentCollected,
        outstandingRent,
        totalArrears,
        cashBalance,
        bankBalance,
        undepositedFundsBalance,
        salaryOfficeExpensesThisMonth,
        portfolio,
      },
      plSeries,
      plThisMonth: {
        from: monthStart,
        to: todayYmd,
        totalIncome,
        totalExpenses,
        netProfit,
      },
      landlordBalances,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return Response.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}
