import sql from "@/app/api/utils/sql";

function addMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function monthCmp(y1, m1, y2, m2) {
  return y1 !== y2 ? y1 - y2 : m1 - m2;
}

// Last day of month as YYYY-MM-DD (month is 1-indexed).
// Date.UTC(year, month, 0): month here is 1-indexed, but Date.UTC treats it as 0-indexed,
// so it resolves to the zeroth day of the next month = last day of this month.
function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

// Returns salary in effect as of dateStr (YYYY-MM-DD) from a pre-fetched
// salary history array (any order). Considers only rows where:
//   effective_date <= dateStr AND (end_date IS NULL OR end_date >= dateStr)
// Among qualifying rows picks the one with the latest effective_date.
function salaryAsOf(history, dateStr) {
  let amount = 0;
  let bestEffective = "";
  for (const row of history) {
    if (row.effective_date > dateStr) continue;
    if (row.end_date !== null && row.end_date < dateStr) continue;
    if (row.effective_date >= bestEffective) {
      bestEffective = row.effective_date;
      amount = Number(row.amount);
    }
  }
  return amount;
}

/**
 * Computes the gross termination settlement for an employee.
 *
 * Algorithm:
 *   1. Find the last fully-paid month (paid_at IS NOT NULL in payroll_entries).
 *   2. If termination month <= last-paid month → gross = 0.
 *   3. Walk from (last-paid month + 1) through termination month:
 *      - Whole months before termination month → full salary for that month.
 *      - Termination month → round(salary * min(dayOfMonth / 30, 1)).
 *   4. Salary for each month is looked up from employee_salaries independently.
 *   5. paye = 0, nssf = 0 (flat, no statutory deductions on termination).
 *
 * Returns:
 *   { total_gross, last_paid_year, last_paid_month, line_items }
 *   line_items: [{ year, month, salary_used, type, days_worked, amount }]
 */
export async function computeTerminationSettlement({ employeeId, terminationDate }) {
  const termDate = new Date(terminationDate);
  const termYear = termDate.getUTCFullYear();
  const termMonth = termDate.getUTCMonth() + 1;
  const termDay = termDate.getUTCDate();

  // 1. Last fully-paid month
  const paidRows = await sql(
    `SELECT r.year, r.month
     FROM payroll_entries pe
     JOIN payroll_runs r ON r.id = pe.run_id
     WHERE pe.employee_id = $1 AND pe.paid_at IS NOT NULL
     ORDER BY r.year DESC, r.month DESC
     LIMIT 1`,
    [employeeId],
  );

  let lastPaidYear = null;
  let lastPaidMonth = null;
  let startYear, startMonth;

  if (paidRows?.length) {
    lastPaidYear = Number(paidRows[0].year);
    lastPaidMonth = Number(paidRows[0].month);

    // Termination is within or before last-paid period → nothing owed
    if (monthCmp(termYear, termMonth, lastPaidYear, lastPaidMonth) <= 0) {
      return { total_gross: 0, last_paid_year: lastPaidYear, last_paid_month: lastPaidMonth, line_items: [] };
    }

    ({ year: startYear, month: startMonth } = addMonth(lastPaidYear, lastPaidMonth));
  } else {
    // Never paid — start from first salary effective date
    const firstRows = await sql(
      `SELECT effective_date::date::text AS effective_date
       FROM employee_salaries
       WHERE employee_id = $1
       ORDER BY effective_date ASC LIMIT 1`,
      [employeeId],
    );
    if (!firstRows?.length) {
      return { total_gross: 0, last_paid_year: null, last_paid_month: null, line_items: [] };
    }
    const d = new Date(firstRows[0].effective_date);
    startYear = d.getUTCFullYear();
    startMonth = d.getUTCMonth() + 1;
  }

  // Fetch full salary history once; salaryAsOf() does JS-side lookup.
  // end_date is included so closed/corrupt rows are excluded from lookups.
  const salaryHistory = await sql(
    `SELECT effective_date::date::text AS effective_date,
            end_date::date::text       AS end_date,
            amount
     FROM employee_salaries
     WHERE employee_id = $1
     ORDER BY effective_date ASC`,
    [employeeId],
  );

  // 2. Walk months
  const lineItems = [];
  let cur = { year: startYear, month: startMonth };

  while (monthCmp(cur.year, cur.month, termYear, termMonth) <= 0) {
    const isTermMonth = monthCmp(cur.year, cur.month, termYear, termMonth) === 0;

    if (isTermMonth) {
      const salary = salaryAsOf(salaryHistory, terminationDate);
      const factor = Math.min(termDay / 30, 1);
      lineItems.push({
        year: cur.year,
        month: cur.month,
        salary_used: salary,
        type: "prorated",
        days_worked: termDay,
        amount: Math.round(salary * factor),
      });
    } else {
      const salary = salaryAsOf(salaryHistory, lastDayOfMonth(cur.year, cur.month));
      lineItems.push({
        year: cur.year,
        month: cur.month,
        salary_used: salary,
        type: "full",
        days_worked: null,
        amount: salary,
      });
    }

    cur = addMonth(cur.year, cur.month);
  }

  const totalGross = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    total_gross: totalGross,
    last_paid_year: lastPaidYear,
    last_paid_month: lastPaidMonth,
    line_items: lineItems,
  };
}
