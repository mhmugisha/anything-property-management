import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const employeeId = toNumber(params?.id);
    if (!employeeId) {
      return Response.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const empRows = await sql(
      `SELECT id, full_name, phone, email, employee_type, payment_method,
              payment_details, status, notes, created_at, updated_at
       FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );

    const employee = empRows?.[0] || null;
    if (!employee) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const [salaryRows, advanceRows, loanRows] = await Promise.all([
      sql(
        `SELECT id, amount, effective_date, end_date, notes, created_at
         FROM employee_salaries
         WHERE employee_id = $1
         ORDER BY effective_date DESC`,
        [employeeId],
      ),
      sql(
        `SELECT
           id, amount, advance_date, description,
           recovered_amount, status, created_at,
           (amount - recovered_amount) AS outstanding
         FROM employee_advances
         WHERE employee_id = $1 AND status <> 'recovered'
         ORDER BY advance_date DESC`,
        [employeeId],
      ),
      sql(
        `SELECT
           id, amount, monthly_instalment, issue_date,
           start_month, start_year, total_instalments,
           paid_instalments, recovered_amount, status, description, created_at,
           (amount - recovered_amount) AS outstanding
         FROM employee_loans
         WHERE employee_id = $1 AND status = 'active'
         ORDER BY issue_date DESC`,
        [employeeId],
      ),
    ]);

    const totalOutstandingAdvances = (advanceRows || []).reduce(
      (s, r) => s + Number(r.outstanding || 0),
      0,
    );
    const totalOutstandingLoans = (loanRows || []).reduce(
      (s, r) => s + Number(r.outstanding || 0),
      0,
    );

    return Response.json({
      employee: {
        id: Number(employee.id),
        full_name: employee.full_name,
        phone: employee.phone || null,
        email: employee.email || null,
        employee_type: employee.employee_type,
        payment_method: employee.payment_method,
        payment_details: employee.payment_details || null,
        status: employee.status,
        notes: employee.notes || null,
        created_at: employee.created_at,
      },
      salary_history: (salaryRows || []).map((r) => ({
        id: Number(r.id),
        amount: Number(r.amount),
        effective_date: r.effective_date,
        end_date: r.end_date || null,
        notes: r.notes || null,
        created_at: r.created_at,
      })),
      outstanding_advances: (advanceRows || []).map((r) => ({
        id: Number(r.id),
        amount: Number(r.amount),
        advance_date: r.advance_date,
        description: r.description || null,
        recovered_amount: Number(r.recovered_amount),
        outstanding: Number(r.outstanding),
        status: r.status,
      })),
      outstanding_loans: (loanRows || []).map((r) => ({
        id: Number(r.id),
        amount: Number(r.amount),
        monthly_instalment: Number(r.monthly_instalment),
        issue_date: r.issue_date,
        start_month: Number(r.start_month),
        start_year: Number(r.start_year),
        total_instalments: Number(r.total_instalments),
        paid_instalments: Number(r.paid_instalments),
        recovered_amount: Number(r.recovered_amount),
        outstanding: Number(r.outstanding),
        status: r.status,
        description: r.description || null,
      })),
      total_outstanding_advances: totalOutstandingAdvances,
      total_outstanding_loans: totalOutstandingLoans,
    });
  } catch (error) {
    console.error("GET /api/payroll/employees/[id] error", error);
    return Response.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const employeeId = toNumber(params?.id);
    if (!employeeId) {
      return Response.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const fields = [];
    const values = [];

    if (body?.full_name !== undefined) {
      const v = String(body.full_name).trim();
      if (!v) return Response.json({ error: "full_name cannot be empty" }, { status: 400 });
      fields.push(`full_name = $${values.length + 1}`);
      values.push(v);
    }
    if (body?.phone !== undefined) {
      fields.push(`phone = $${values.length + 1}`);
      values.push(String(body.phone || "").trim() || null);
    }
    if (body?.email !== undefined) {
      fields.push(`email = $${values.length + 1}`);
      values.push(String(body.email || "").trim() || null);
    }
    if (body?.employee_type !== undefined) {
      if (!["staff", "casual"].includes(body.employee_type)) {
        return Response.json({ error: "Invalid employee_type" }, { status: 400 });
      }
      fields.push(`employee_type = $${values.length + 1}`);
      values.push(body.employee_type);
    }
    if (body?.payment_method !== undefined) {
      if (!["cash", "bank", "momo"].includes(body.payment_method)) {
        return Response.json({ error: "Invalid payment_method" }, { status: 400 });
      }
      fields.push(`payment_method = $${values.length + 1}`);
      values.push(body.payment_method);
    }
    if (body?.payment_details !== undefined) {
      fields.push(`payment_details = $${values.length + 1}`);
      values.push(String(body.payment_details || "").trim() || null);
    }
    if (body?.notes !== undefined) {
      fields.push(`notes = $${values.length + 1}`);
      values.push(String(body.notes || "").trim() || null);
    }
    if (body?.status !== undefined) {
      if (!["active", "inactive"].includes(body.status)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }
      fields.push(`status = $${values.length + 1}`);
      values.push(body.status);
    }

    if (fields.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(employeeId);

    await sql(
      `UPDATE employees SET ${fields.join(", ")} WHERE id = $${values.length}`,
      values,
    );

    return Response.json({ success: true, employee_id: employeeId });
  } catch (error) {
    console.error("PUT /api/payroll/employees/[id] error", error);
    return Response.json({ error: "Failed to update employee" }, { status: 500 });
  }
}
