import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

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

function str(v) {
  return String(v || "").trim() || null;
}

export async function GET(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const includeInactive = status === "all";

    const rows = await sql(
      `SELECT
         e.id,
         e.full_name,
         e.position,
         e.start_date,
         e.phone,
         e.email,
         e.employee_type,
         e.payment_method,
         e.payment_details,
         e.payment_bank_name,
         e.payment_account_number,
         e.payment_account_name,
         e.payment_phone,
         e.status,
         e.notes,
         e.created_at,
         s.amount AS current_salary,
         s.effective_date AS salary_effective_date
       FROM employees e
       LEFT JOIN LATERAL (
         SELECT amount, effective_date
         FROM employee_salaries
         WHERE employee_id = e.id
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         ORDER BY effective_date DESC
         LIMIT 1
       ) s ON true
       WHERE ${includeInactive ? "1=1" : "e.status = $1"}
       ORDER BY e.full_name ASC`,
      includeInactive ? [] : [status],
    );

    return Response.json({
      employees: (rows || []).map((r) => ({
        id: Number(r.id),
        full_name: r.full_name,
        position: r.position || null,
        start_date: r.start_date || null,
        phone: r.phone || null,
        email: r.email || null,
        employee_type: r.employee_type,
        payment_method: r.payment_method,
        payment_details: r.payment_details || null,
        payment_bank_name: r.payment_bank_name || null,
        payment_account_number: r.payment_account_number || null,
        payment_account_name: r.payment_account_name || null,
        payment_phone: r.payment_phone || null,
        status: r.status,
        notes: r.notes || null,
        created_at: r.created_at,
        current_salary: r.current_salary ? Number(r.current_salary) : null,
        salary_effective_date: r.salary_effective_date || null,
      })),
    });
  } catch (error) {
    console.error("GET /api/payroll/employees error", error);
    return Response.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json().catch(() => ({}));

    const fullName = str(body?.full_name);
    if (!fullName) {
      return Response.json({ error: "full_name is required" }, { status: 400 });
    }

    const position = str(body?.position);
    if (!position) {
      return Response.json({ error: "position is required" }, { status: 400 });
    }

    const startDate = parseDate(body?.start_date);
    if (!startDate) {
      return Response.json({ error: "start_date is required" }, { status: 400 });
    }

    const initialSalary = toNumber(body?.initial_salary);
    if (!initialSalary || initialSalary <= 0) {
      return Response.json({ error: "initial_salary is required and must be > 0" }, { status: 400 });
    }

    const employeeType = ["staff", "casual"].includes(body?.employee_type)
      ? body.employee_type
      : "staff";
    const paymentMethod = ["cash", "bank", "momo"].includes(body?.payment_method)
      ? body.payment_method
      : "cash";

    const phone = str(body?.phone);
    const email = str(body?.email);
    const notes = str(body?.notes);

    // Payment method conditional fields
    const paymentBankName = str(body?.payment_bank_name);
    const paymentAccountNumber = str(body?.payment_account_number);
    const paymentAccountName = str(body?.payment_account_name);
    const paymentPhone = str(body?.payment_phone);

    // salary_effective_date defaults to start_date
    const salaryEffectiveDate =
      parseDate(body?.salary_effective_date) || startDate;

    const empRows = await sql(
      `INSERT INTO employees
         (full_name, position, start_date, phone, email,
          employee_type, payment_method,
          payment_bank_name, payment_account_number,
          payment_account_name, payment_phone,
          notes, created_by)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        fullName,
        position,
        startDate,
        phone,
        email,
        employeeType,
        paymentMethod,
        paymentBankName,
        paymentAccountNumber,
        paymentAccountName,
        paymentPhone,
        notes,
        perm.staff.id,
      ],
    );

    const employeeId = Number(empRows[0].id);

    await sql(
      `INSERT INTO employee_salaries (employee_id, amount, effective_date, created_by)
       VALUES ($1, $2, $3::date, $4)`,
      [employeeId, initialSalary, salaryEffectiveDate, perm.staff.id],
    );

    return Response.json(
      { success: true, employee_id: employeeId },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/payroll/employees error", error);
    return Response.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
