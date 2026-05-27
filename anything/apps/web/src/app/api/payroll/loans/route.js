import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";
import { getAccountIdByCode } from "@/app/api/utils/accounting";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function addMonths(month, year, n) {
  let m = month - 1 + n;
  const y = year + Math.floor(m / 12);
  m = m % 12;
  return { month: m + 1, year: y };
}

export async function GET(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = toNumber(searchParams.get("employee_id"));
    const status = searchParams.get("status") || null;

    const where = ["1=1"];
    const values = [];

    if (employeeId) {
      where.push(`l.employee_id = $${values.length + 1}`);
      values.push(employeeId);
    }
    if (status) {
      where.push(`l.status = $${values.length + 1}`);
      values.push(status);
    }

    const rows = await sql(
      `SELECT
         l.id,
         l.employee_id,
         e.full_name AS employee_name,
         l.amount,
         l.monthly_instalment,
         l.issue_date,
         l.start_month,
         l.start_year,
         l.total_instalments,
         l.paid_instalments,
         l.recovered_amount,
         l.status,
         l.description,
         l.created_at,
         (l.amount - l.recovered_amount) AS outstanding,
         (l.total_instalments - l.paid_instalments) AS remaining_instalments
       FROM employee_loans l
       JOIN employees e ON e.id = l.employee_id
       WHERE ${where.join(" AND ")}
       ORDER BY l.issue_date DESC, l.id DESC`,
      values,
    );

    const totalOutstanding = (rows || [])
      .filter((r) => r.status === "active")
      .reduce((s, r) => s + Number(r.outstanding || 0), 0);

    return Response.json({
      loans: (rows || []).map((r) => {
        const remaining = Number(r.remaining_instalments);
        const endPeriod =
          remaining > 0
            ? addMonths(Number(r.start_month), Number(r.start_year), Number(r.paid_instalments) + remaining - 1)
            : null;
        return {
          id: Number(r.id),
          employee_id: Number(r.employee_id),
          employee_name: r.employee_name,
          amount: Number(r.amount),
          monthly_instalment: Number(r.monthly_instalment),
          issue_date: r.issue_date,
          start_month: Number(r.start_month),
          start_year: Number(r.start_year),
          total_instalments: Number(r.total_instalments),
          paid_instalments: Number(r.paid_instalments),
          recovered_amount: Number(r.recovered_amount),
          outstanding: Number(r.outstanding),
          remaining_instalments: remaining,
          end_month: endPeriod?.month || null,
          end_year: endPeriod?.year || null,
          status: r.status,
          description: r.description || null,
          created_at: r.created_at,
        };
      }),
      total_outstanding: totalOutstanding,
    });
  } catch (error) {
    console.error("GET /api/payroll/loans error", error);
    return Response.json({ error: "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json().catch(() => ({}));

    const employeeId = toNumber(body?.employee_id);
    const amount = toNumber(body?.amount);
    const monthlyInstalment = toNumber(body?.monthly_instalment);
    const issueDate =
      parseDate(body?.issue_date) || new Date().toISOString().slice(0, 10);
    const startMonth = toNumber(body?.start_month);
    const startYear = toNumber(body?.start_year);
    const paymentAccountId = toNumber(body?.payment_account_id);
    const description = String(body?.description || "").trim() || null;

    if (!employeeId) return Response.json({ error: "employee_id is required" }, { status: 400 });
    if (!amount || amount <= 0) return Response.json({ error: "amount must be > 0" }, { status: 400 });
    if (!monthlyInstalment || monthlyInstalment <= 0) {
      return Response.json({ error: "monthly_instalment must be > 0" }, { status: 400 });
    }
    if (monthlyInstalment > amount) {
      return Response.json({ error: "monthly_instalment cannot exceed loan amount" }, { status: 400 });
    }
    if (!startMonth || startMonth < 1 || startMonth > 12) {
      return Response.json({ error: "start_month must be 1-12" }, { status: 400 });
    }
    if (!startYear || startYear < 2000) {
      return Response.json({ error: "start_year is required" }, { status: 400 });
    }
    if (!paymentAccountId) {
      return Response.json({ error: "payment_account_id is required" }, { status: 400 });
    }

    const totalInstalments = Math.ceil(amount / monthlyInstalment);

    const [empRows, staffLoansAcctId] = await Promise.all([
      sql(`SELECT id, full_name FROM employees WHERE id = $1 LIMIT 1`, [employeeId]),
      getAccountIdByCode("1410"),
    ]);

    if (!empRows?.length) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!staffLoansAcctId) {
      return Response.json({ error: "Staff Loans account (1410) not configured" }, { status: 500 });
    }

    const employeeName = empRows[0].full_name;

    // Insert loan
    const loanRows = await sql(
      `INSERT INTO employee_loans
         (employee_id, amount, monthly_instalment, issue_date, start_month, start_year,
          total_instalments, description, payment_account_id, created_by)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        employeeId,
        amount,
        monthlyInstalment,
        issueDate,
        startMonth,
        startYear,
        totalInstalments,
        description,
        paymentAccountId,
        perm.staff.id,
      ],
    );
    const loanId = Number(loanRows[0].id);

    // GL: Dr 1410 Staff Loans / Cr payment_account_id
    const txnRows = await sql(
      `INSERT INTO transactions (
         transaction_date, description, reference_number,
         debit_account_id, credit_account_id,
         amount, currency, created_by,
         source_type, source_id, approval_status
       ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'staff_loan', $8, 'approved')
       RETURNING id`,
      [
        issueDate,
        `Staff loan - ${employeeName}`,
        `LOAN-${loanId}`,
        staffLoansAcctId,
        paymentAccountId,
        amount,
        perm.staff.id,
        loanId,
      ],
    );
    const transactionId = Number(txnRows[0].id);

    await sql(
      `UPDATE employee_loans SET transaction_id = $1 WHERE id = $2`,
      [transactionId, loanId],
    );

    const endPeriod = addMonths(startMonth, startYear, totalInstalments - 1);

    return Response.json(
      {
        success: true,
        loan_id: loanId,
        transaction_id: transactionId,
        total_instalments: totalInstalments,
        end_month: endPeriod.month,
        end_year: endPeriod.year,
        end_label: `${MONTH_NAMES[endPeriod.month]} ${endPeriod.year}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/payroll/loans error", error);
    return Response.json({ error: "Failed to issue loan" }, { status: 500 });
  }
}
