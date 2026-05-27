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

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const employeeId = toNumber(params?.id);
    if (!employeeId) {
      return Response.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const amount = toNumber(body?.amount);
    const effectiveDate = parseDate(body?.effective_date);
    const notes = String(body?.notes || "").trim() || null;

    if (!amount || amount <= 0) {
      return Response.json({ error: "amount must be > 0" }, { status: 400 });
    }
    if (!effectiveDate) {
      return Response.json({ error: "effective_date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const empRows = await sql(
      `SELECT id FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );
    if (!empRows?.length) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    await sql.transaction((txn) => [
      // Close previous active salary (set end_date = effective_date - 1 day)
      txn(
        `UPDATE employee_salaries
         SET end_date = $1::date - INTERVAL '1 day'
         WHERE employee_id = $2
           AND (end_date IS NULL OR end_date >= $1::date)`,
        [effectiveDate, employeeId],
      ),
      // Insert new salary record
      txn(
        `INSERT INTO employee_salaries (employee_id, amount, effective_date, notes, created_by)
         VALUES ($1, $2, $3::date, $4, $5)`,
        [employeeId, amount, effectiveDate, notes, perm.staff.id],
      ),
    ]);

    return Response.json({ success: true, employee_id: employeeId, amount, effective_date: effectiveDate });
  } catch (error) {
    console.error("POST /api/payroll/employees/[id]/salary error", error);
    return Response.json({ error: "Failed to update salary" }, { status: 500 });
  }
}
