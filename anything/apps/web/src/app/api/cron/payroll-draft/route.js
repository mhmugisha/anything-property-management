import sql from "@/app/api/utils/sql";
import { isVercelCronRequest } from "@/app/api/utils/cron";

export async function GET(request) {
  if (!isVercelCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Only run on the last day of the month
    if (tomorrow.getDate() !== 1) {
      return Response.json({ skipped: true, reason: "not last day of month" });
    }

    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const existing = await sql(
      `SELECT id FROM payroll_runs WHERE month = $1 AND year = $2 LIMIT 1`,
      [month, year],
    );
    if (existing?.length > 0) {
      return Response.json({ skipped: true, reason: "run already exists", run_id: Number(existing[0].id) });
    }

    const employees = await sql`
      SELECT id, payment_method FROM employees WHERE status = 'active' ORDER BY full_name
    `;
    if (!employees?.length) {
      return Response.json({ skipped: true, reason: "no active employees" });
    }

    const runRows = await sql`
      INSERT INTO payroll_runs (month, year, status, total_gross, total_deductions, total_net, created_by)
      VALUES (${month}, ${year}, 'draft', 0, 0, 0, NULL)
      RETURNING id
    `;
    const runId = Number(runRows[0].id);

    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    let totalGross = 0;
    let totalDeductions = 0;

    for (const emp of employees) {
      const empId = Number(emp.id);

      const salaryRows = await sql(
        `SELECT amount FROM employee_salaries
         WHERE employee_id = $1
           AND effective_date <= $2::date
           AND (end_date IS NULL OR end_date >= $2::date)
         ORDER BY effective_date DESC LIMIT 1`,
        [empId, firstDay],
      );
      const grossPay = salaryRows?.length ? Number(salaryRows[0].amount) : 0;

      const advRows = await sql(
        `SELECT COALESCE(SUM(amount - recovered_amount), 0)::numeric AS total
         FROM employee_advances
         WHERE employee_id = $1
           AND status != 'recovered'
           AND COALESCE(is_voided, false) = false`,
        [empId],
      );
      const advanceDeduction = Math.min(Number(advRows?.[0]?.total || 0), grossPay);

      const loanRows = await sql(
        `SELECT COALESCE(SUM(monthly_instalment), 0)::numeric AS total
         FROM employee_loans WHERE employee_id = $1 AND status = 'active'`,
        [empId],
      );
      const loanDeduction = Math.min(
        Number(loanRows?.[0]?.total || 0),
        Math.max(0, grossPay - advanceDeduction),
      );

      const netPay = Math.max(0, grossPay - advanceDeduction - loanDeduction);

      await sql(
        `INSERT INTO payroll_entries
           (run_id, employee_id, gross_pay, advance_deduction, loan_deduction,
            paye, nssf, net_pay, payment_method)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)`,
        [runId, empId, grossPay, advanceDeduction, loanDeduction, netPay, emp.payment_method],
      );

      totalGross += grossPay;
      totalDeductions += advanceDeduction + loanDeduction;
    }

    await sql`
      UPDATE payroll_runs
      SET total_gross = ${totalGross}, total_deductions = ${totalDeductions},
          total_net = ${totalGross - totalDeductions}
      WHERE id = ${runId}
    `;

    const employeeCount = employees.length;

    // Send email notification if Resend is configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const monthNames = ["January","February","March","April","May","June",
        "July","August","September","October","November","December"];
      const periodLabel = `${monthNames[month - 1]} ${year}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "payroll@exelarealtors.com",
          to: ["admin@exelarealtors.com"],
          subject: `Payroll draft created — ${periodLabel}`,
          html: `<p>A draft payroll run for <strong>${periodLabel}</strong> has been created automatically with <strong>${employeeCount} employees</strong>.</p><p>Run ID: ${runId}</p><p>Please review and approve it in the payroll module.</p>`,
        }),
      }).catch((err) => console.error("Resend email failed:", err));
    } else {
      console.log(`[cron/payroll-draft] Draft run ${runId} created for ${month}/${year} with ${employeeCount} employees. No RESEND_API_KEY set, skipping email.`);
    }

    return Response.json({ success: true, run_id: runId, employee_count: employeeCount });
  } catch (error) {
    console.error("GET /api/cron/payroll-draft error", error);
    return Response.json({ error: "Failed to create draft payroll run" }, { status: 500 });
  }
}
