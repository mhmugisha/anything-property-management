import sql from "@/app/api/utils/sql";
import { hasPermission, requirePermission } from "@/app/api/utils/staff";
import {
  getAccountBalancesByIds,
  getDueToLandlordsByProperty,
} from "@/app/api/utils/accounting";

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
      mgmtFeeAccruedRows,
      incomeSeriesRows,
      expenseSeriesRows,
      incomeRows,
      expenseRows,
      landlordRows,
      dueByProperty,
    ] = await Promise.all([
      // Total rent billed (current month invoices)
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM invoices
        WHERE invoice_month = ${currentMonth}
          AND invoice_year = ${currentYear}
          AND status <> 'void'
          AND COALESCE(is_deleted, false) = false
          AND COALESCE(approval_status, 'approved') = 'approved'
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
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND p.is_reversed = false
          AND COALESCE(p.approval_status, 'approved') = 'approved'
      `,

      // Outstanding rent (all open invoices)
      sql`
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS total
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
      `,

      // Arrears (not paid in issue month)
      sql`
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS total
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND (
            i.invoice_year < ${currentYear}
            OR (i.invoice_year = ${currentYear} AND i.invoice_month < ${currentMonth})
          )
          AND EXISTS (
            SELECT 1 FROM leases l
            WHERE l.id = i.lease_id
              AND l.status = 'active'
          )
      `,

      // Legacy arrears calculation
      sql`
        SELECT COALESCE(SUM(i.amount - i.paid_amount), 0) AS total
        FROM invoices i
        WHERE (i.amount - i.paid_amount) > 0
          AND i.status <> 'void'
          AND COALESCE(i.is_deleted, false) = false
          AND COALESCE(i.approval_status, 'approved') = 'approved'
          AND i.due_date < ${monthStart}::date
          AND EXISTS (
            SELECT 1 FROM leases l
            WHERE l.id = i.lease_id
              AND l.status = 'active'
          )
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

      // Management fees collected (this month):
      // - Percentage fee properties: fees on payments actually received this month
      // - Fixed fee properties: full fixed fee amount regardless of collections
      sql`
        WITH percent_collected AS (
          SELECT
            i.property_id,
            SUM(pia.amount_applied)::numeric(15,2) AS collected,
            MAX(COALESCE(p.management_fee_percent, 0))::numeric(5,2) AS fee_percent
          FROM payment_invoice_allocations pia
          JOIN invoices i ON i.id = pia.invoice_id
          JOIN payments pay ON pay.id = pia.payment_id
          JOIN properties p ON p.id = i.property_id
          WHERE pay.payment_date >= ${monthStart}::date
            AND pay.payment_date <= ${todayYmd}::date
            AND pay.is_reversed = false
            AND COALESCE(i.is_deleted, false) = false
            AND COALESCE(p.management_fee_type, 'percent') = 'percent'
            AND i.invoice_month = ${currentMonth}
            AND i.invoice_year = ${currentYear}
          GROUP BY i.property_id
        ),
        fixed_accrued AS (
          SELECT
            i.property_id,
            LEAST(
              MAX(COALESCE(p.management_fee_fixed_amount, 0))::numeric(15,2),
              SUM(i.amount)::numeric(15,2)
            ) AS fee_amount
          FROM invoices i
          JOIN properties p ON p.id = i.property_id
          WHERE i.invoice_month = ${currentMonth}
            AND i.invoice_year = ${currentYear}
            AND i.status <> 'void'
            AND COALESCE(i.is_deleted, false) = false
            AND COALESCE(p.management_fee_type, 'percent') = 'fixed'
          GROUP BY i.property_id
        )
        SELECT COALESCE(
          (SELECT SUM(ROUND((collected * fee_percent / 100.0)::numeric, 2)) FROM percent_collected) +
          (SELECT COALESCE(SUM(fee_amount), 0) FROM fixed_accrued),
          0
        ) AS total
      `,

      // Management fees accrued (this month) — based on all invoices regardless of payment
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
            AND COALESCE(i.approval_status, 'approved') = 'approved'
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
          AND COALESCE(t.approval_status,'approved') = 'approved'
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
          AND COALESCE(t.approval_status,'approved') = 'approved'
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
          AND COALESCE(t.approval_status,'approved') = 'approved'
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
          AND COALESCE(t.approval_status,'approved') = 'approved'
          AND t.transaction_date >= ${monthStart}::date
          AND t.transaction_date <= ${todayYmd}::date
      `,

      // Landlord display fields for the balances card; balances come from
      // the trusted per-property dues below.
      sql`
        SELECT
          l.id,
          l.title,
          l.full_name,
          (CASE WHEN l.due_date IS NULL THEN NULL ELSE EXTRACT(day FROM l.due_date)::int END) AS due_day
        FROM landlords l
        ORDER BY l.full_name ASC
        LIMIT 200
      `,

      // Due to landlords per property (source tables), shared by the KPI
      // total and the balances card so both use one computation.
      getDueToLandlordsByProperty(),
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
    const managementFeesAccrued = Number(mgmtFeeAccruedRows?.[0]?.total || 0);
    const totalIncome = Number(incomeRows?.[0]?.total || 0);
    const totalExpenses = Number(expenseRows?.[0]?.total || 0);
    const netProfit = totalIncome - totalExpenses;

    // Fetch account balances in parallel
    const codeToId = await getAccountIdsByCodes([
      "1110",
      "1120",
      "1130",
      "5160",
      "5210",
      "2100",
    ]);

    const cashId = codeToId["1110"] || null;
    const bankId = codeToId["1120"] || null;
    const undepositedFundsId = codeToId["1130"] || null;
    const salariesId = codeToId["5160"] || null;
    const officeExpensesId = codeToId["5210"] || null;
    const acct2100Id = codeToId["2100"] || null;

    // Ledger reconciliation card: accounting admins only, same gate as the
    // GL 2100 reconciliation report. Everyone else gets null.
    const canSeeGlRecon =
      perm.staff?.role_name === "Admin" &&
      hasPermission(perm.permissions, "accounting");

    const [balances, salaryOfficeExpensesThisMonth, gl2100Balance] =
      await Promise.all([
        getAccountBalancesByIds([cashId, bankId, undepositedFundsId]),

        // Salary + Office Expenses (this month)
        (async () => {
          const expenseIds = [salariesId, officeExpensesId].filter(Boolean);
          if (expenseIds.length === 0) return 0;

          const expRows = await sql(
            `
            SELECT COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            WHERE COALESCE(t.is_deleted,false) = false
              AND COALESCE(t.approval_status,'approved') = 'approved'
              AND t.transaction_date >= $1::date
              AND t.transaction_date <= $2::date
              AND t.debit_account_id = ANY($3)
          `,
            [monthStart, todayYmd, expenseIds],
          );
          return Number(expRows?.[0]?.total || 0);
        })(),

        // GL 2100 balance on the report's basis (trial balance: not deleted,
        // approved only; credit − debit). The ::int form nets a row with 2100
        // on both sides to zero.
        (async () => {
          if (!canSeeGlRecon || !acct2100Id) return null;
          const [row] = await sql`
          SELECT COALESCE(SUM(
            (t.credit_account_id = ${acct2100Id})::int * t.amount
              - (t.debit_account_id = ${acct2100Id})::int * t.amount
          ), 0)::numeric AS total
          FROM transactions t
          WHERE (t.debit_account_id = ${acct2100Id} OR t.credit_account_id = ${acct2100Id})
            AND COALESCE(t.is_deleted, false) = false
            AND COALESCE(t.approval_status, 'approved') = 'approved'
        `;
          return Number(row?.total || 0);
        })(),
      ]);

    const cashBalance = Number(balances[String(cashId)] || 0);
    const bankBalance = Number(balances[String(bankId)] || 0);
    const undepositedFundsBalance = Number(
      balances[String(undepositedFundsId)] || 0,
    );

    // Due to Landlords: grand total of getDueToLandlordsBalance across every
    // property (source tables: net rent after fees − payouts − deductions −
    // landlord maintenance + adjustments). The 2100 ledger is out of sync and
    // is not used here. Same sum as getTotalDueToLandlords.
    const amountDueToLandlords = (dueByProperty || []).reduce(
      (sum, r) => sum + r.due,
      0,
    );

    // GL 2100 vs source, totals only. Same figures as the report's totals.
    const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
    const glReconciliation =
      gl2100Balance === null
        ? null
        : {
            gl_2100: round2(gl2100Balance),
            source_due: round2(amountDueToLandlords),
            gap: round2(gl2100Balance - amountDueToLandlords),
          };

    // Net due per landlord: the same per-property dues, summed by landlord.
    const dueByLandlord = new Map();
    for (const r of dueByProperty || []) {
      dueByLandlord.set(
        r.landlordId,
        (dueByLandlord.get(r.landlordId) || 0) + r.due,
      );
    }

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
          balance: Number(dueByLandlord.get(Number(l.id)) || 0),
          next_due_date: nextDueYmd,
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
        managementFeesAccrued,
        managementFeesThisMonth,
        amountDueToLandlords: Number(amountDueToLandlords || 0),
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
      glReconciliation,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return Response.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}
