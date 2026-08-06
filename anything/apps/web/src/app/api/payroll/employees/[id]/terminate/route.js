import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
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

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function computeNssf(gross) {
  return Math.round(gross * 0.05);
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });
  if (perm.staff.role_name !== "Admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const employeeId = toNumber(params?.id);
    if (!employeeId) {
      return Response.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const terminationDate = parseDate(body?.termination_date);
    if (!terminationDate) {
      return Response.json({ error: "termination_date is required" }, { status: 400 });
    }

    const salaryType = body?.salary_type;
    if (!["full", "prorated"].includes(salaryType)) {
      return Response.json({ error: "salary_type must be 'full' or 'prorated'" }, { status: 400 });
    }

    const advanceAction = body?.advance_action;
    const loanAction = body?.loan_action;
    if (!["recover", "writeoff"].includes(advanceAction)) {
      return Response.json({ error: "advance_action must be 'recover' or 'writeoff'" }, { status: 400 });
    }
    if (!["recover", "writeoff"].includes(loanAction)) {
      return Response.json({ error: "loan_action must be 'recover' or 'writeoff'" }, { status: 400 });
    }

    const shortfallAction = body?.shortfall_action || "outstanding";
    if (!["outstanding", "writeoff"].includes(shortfallAction)) {
      return Response.json({ error: "shortfall_action must be 'outstanding' or 'writeoff'" }, { status: 400 });
    }

    const paymentAccountId = toNumber(body?.payment_account_id);
    const paymentDate = parseDate(body?.payment_date) || terminationDate;
    const terminationReason = typeof body?.termination_reason === "string"
      ? body.termination_reason.trim() || null
      : null;

    const empRows = await sql(
      `SELECT id, full_name, status FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );
    const employee = empRows?.[0];
    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }
    if (employee.status === "terminated") {
      return Response.json({ error: "Employee is already terminated" }, { status: 400 });
    }

    const empName = employee.full_name;

    // Compute final salary
    const salaryRows = await sql(
      `SELECT amount FROM employee_salaries
       WHERE employee_id = $1 AND effective_date <= $2::date
       ORDER BY effective_date DESC LIMIT 1`,
      [employeeId, terminationDate],
    );
    const monthlySalary = salaryRows?.length ? Number(salaryRows[0].amount) : 0;

    const termDate = new Date(terminationDate);
    const year = termDate.getUTCFullYear();
    const month = termDate.getUTCMonth() + 1;
    const dayOfMonth = termDate.getUTCDate();
    const totalDays = daysInMonth(year, month);

    let grossSalary;
    if (salaryType === "prorated") {
      grossSalary = Math.round((monthlySalary / totalDays) * dayOfMonth);
    } else {
      grossSalary = monthlySalary;
    }

    const paye = 0;
    const nssf = computeNssf(grossSalary);
    const netBeforeAdvances = grossSalary - paye - nssf;

    // Outstanding advances and loans
    const advRows = await sql(
      `SELECT COALESCE(SUM(amount - COALESCE(recovered_amount, 0)), 0)::numeric AS total
       FROM employee_advances
       WHERE employee_id = $1
         AND status != 'recovered'
         AND COALESCE(is_voided, false) = false`,
      [employeeId],
    );
    const outstandingAdvances = Number(advRows?.[0]?.total || 0);

    const loanRows = await sql(
      `SELECT COALESCE(SUM(amount - recovered_amount), 0)::numeric AS total
       FROM employee_loans WHERE employee_id = $1 AND status != 'fully_paid'`,
      [employeeId],
    );
    const outstandingLoans = Number(loanRows?.[0]?.total || 0);

    const netPayable = netBeforeAdvances - outstandingAdvances - outstandingLoans;

    // Fetch GL account IDs needed
    const [acct5160Id, acct2310Id, acct2320Id, acct2300Id, acct1400Id, acct1410Id, acct5300Id] =
      await Promise.all([
        getAccountIdByCode("5160"),
        getAccountIdByCode("2310"),
        getAccountIdByCode("2320"),
        getAccountIdByCode("2300"),
        getAccountIdByCode("1400"),
        getAccountIdByCode("1410"),
        getAccountIdByCode("5300"),
      ]);

    if (!acct5160Id || !acct2300Id) {
      return Response.json(
        { error: "Required GL accounts (5160 / 2300) not configured" },
        { status: 500 },
      );
    }

    const propertyId = null;

    // 1. Accrue final salary: Dr 5160 / Cr 2310, 2320, 2300
    if (grossSalary > 0) {
      // For simplicity with multiple credits we split into separate transactions:
      // Cr 2310 (PAYE) — only if paye > 0
      if (paye > 0 && acct2310Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Final salary PAYE - ${empName}`, acct5160Id, acct2310Id, paye, perm.staff.id, employeeId],
        );
      }
      // Cr 2320 (NSSF)
      if (nssf > 0 && acct2320Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Final salary NSSF - ${empName}`, acct5160Id, acct2320Id, nssf, perm.staff.id, employeeId],
        );
      }
      // Cr 2300 (net before advances/loans)
      if (netBeforeAdvances > 0 && acct2300Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Final salary - ${empName}`, acct5160Id, acct2300Id, netBeforeAdvances, perm.staff.id, employeeId],
        );
      }
    }

    // 2. Advances
    if (outstandingAdvances > 0 && acct1400Id) {
      if (advanceAction === "recover" && acct2300Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Advance recovery on termination - ${empName}`, acct2300Id, acct1400Id, outstandingAdvances, perm.staff.id, employeeId],
        );
      } else if (advanceAction === "writeoff" && acct5300Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Advance write-off on termination - ${empName}`, acct5300Id, acct1400Id, outstandingAdvances, perm.staff.id, employeeId],
        );
      }
    }

    // 3. Loans
    if (outstandingLoans > 0 && acct1410Id) {
      if (loanAction === "recover" && acct2300Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Loan recovery on termination - ${empName}`, acct2300Id, acct1410Id, outstandingLoans, perm.staff.id, employeeId],
        );
      } else if (loanAction === "writeoff" && acct5300Id) {
        await sql(
          `INSERT INTO transactions
             (transaction_date, description, debit_account_id, credit_account_id,
              amount, currency, created_by, source_type, source_id)
           VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
          [paymentDate, `Loan write-off on termination - ${empName}`, acct5300Id, acct1410Id, outstandingLoans, perm.staff.id, employeeId],
        );
      }
    }

    // 4. Final pay disbursement (only if net_payable > 0)
    if (netPayable > 0 && paymentAccountId && acct2300Id) {
      await sql(
        `INSERT INTO transactions
           (transaction_date, description, debit_account_id, credit_account_id,
            amount, currency, created_by, source_type, source_id)
         VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
        [paymentDate, `Final pay - ${empName}`, acct2300Id, paymentAccountId, netPayable, perm.staff.id, employeeId],
      );
    }

    // 5. Shortfall write-off (only if net_payable < 0 and shortfall_action = 'writeoff')
    if (netPayable < 0 && shortfallAction === "writeoff" && acct5300Id && acct2300Id) {
      const shortfall = Math.abs(netPayable);
      await sql(
        `INSERT INTO transactions
           (transaction_date, description, debit_account_id, credit_account_id,
            amount, currency, created_by, source_type, source_id)
         VALUES ($1::date, $2, $3, $4, $5, 'UGX', $6, 'termination', $7)`,
        [paymentDate, `Shortfall write-off on termination - ${empName}`, acct5300Id, acct2300Id, shortfall, perm.staff.id, employeeId],
      );
    }

    // 6. Update employee record
    await sql(
      `UPDATE employees SET
         status = 'terminated',
         terminated_at = $2::date,
         termination_reason = $3,
         termination_salary_type = $4,
         termination_advance_action = $5,
         termination_loan_action = $6,
         updated_at = NOW()
       WHERE id = $1`,
      [employeeId, terminationDate, terminationReason, salaryType, advanceAction, loanAction],
    );

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "employee.terminate",
      entityType: "employee",
      entityId: employeeId,
      oldValues: { status: employee.status },
      newValues: { status: "terminated", terminated_at: terminationDate },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("POST /api/payroll/employees/[id]/terminate error:", error.message, "\n", error.stack);
    return Response.json({ error: error.message || "Failed to terminate employee" }, { status: 500 });
  }
}
