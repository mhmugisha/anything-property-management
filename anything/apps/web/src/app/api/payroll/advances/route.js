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
      where.push(`a.employee_id = $${values.length + 1}`);
      values.push(employeeId);
    }
    if (status) {
      where.push(`a.status = $${values.length + 1}`);
      values.push(status);
    }

    const rows = await sql(
      `SELECT
         a.id,
         a.employee_id,
         e.full_name AS employee_name,
         a.amount,
         a.advance_date,
         a.description,
         a.recovered_amount,
         a.status,
         a.is_voided,
         a.voided_at,
         a.created_at,
         (a.amount - a.recovered_amount) AS outstanding
       FROM employee_advances a
       JOIN employees e ON e.id = a.employee_id
       WHERE ${where.join(" AND ")}
       ORDER BY a.advance_date DESC, a.id DESC`,
      values,
    );

    const totalOutstanding = (rows || [])
      .filter((r) => r.status !== "recovered" && r.is_voided !== true)
      .reduce((s, r) => s + Number(r.outstanding || 0), 0);

    return Response.json({
      advances: (rows || []).map((r) => ({
        id: Number(r.id),
        employee_id: Number(r.employee_id),
        employee_name: r.employee_name,
        amount: Number(r.amount),
        advance_date: r.advance_date,
        description: r.description || null,
        recovered_amount: Number(r.recovered_amount),
        outstanding: Number(r.outstanding),
        status: r.status,
        is_voided: r.is_voided === true,
        voided_at: r.voided_at || null,
        created_at: r.created_at,
      })),
      total_outstanding: totalOutstanding,
    });
  } catch (error) {
    console.error("GET /api/payroll/advances error", error);
    return Response.json({ error: "Failed to fetch advances" }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "payroll");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json().catch(() => ({}));

    const employeeId = toNumber(body?.employee_id);
    const amount = toNumber(body?.amount);
    const advanceDate =
      parseDate(body?.advance_date) || new Date().toISOString().slice(0, 10);
    const paymentAccountId = toNumber(body?.payment_account_id);
    const description = String(body?.description || "").trim() || null;

    if (!employeeId) return Response.json({ error: "employee_id is required" }, { status: 400 });
    if (!amount || amount <= 0) return Response.json({ error: "amount must be > 0" }, { status: 400 });
    if (!paymentAccountId) return Response.json({ error: "payment_account_id is required" }, { status: 400 });

    const [empRows, staffAdvancesAcctId] = await Promise.all([
      sql(`SELECT id, full_name FROM employees WHERE id = $1 LIMIT 1`, [employeeId]),
      getAccountIdByCode("1400"),
    ]);

    if (!empRows?.length) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }
    if (!staffAdvancesAcctId) {
      return Response.json({ error: "Staff Advances account (1400) not configured" }, { status: 500 });
    }

    const employeeName = empRows[0].full_name;

    // Insert advance row first to get ID for GL source_id
    const advanceRows = await sql(
      `INSERT INTO employee_advances
         (employee_id, amount, advance_date, description, payment_account_id, created_by)
       VALUES ($1, $2, $3::date, $4, $5, $6)
       RETURNING id`,
      [employeeId, amount, advanceDate, description, paymentAccountId, perm.staff.id],
    );
    const advanceId = Number(advanceRows[0].id);

    // GL entry: Dr 1400 Staff Advances / Cr payment_account_id
    const txnRows = await sql(
      `INSERT INTO transactions (
         transaction_date, description, reference_number,
         debit_account_id, credit_account_id,
         amount, currency, created_by,
         source_type, source_id, approval_status
       ) VALUES ($1::date, $2, $3, $4, $5, $6, 'UGX', $7, 'staff_advance', $8, 'approved')
       RETURNING id`,
      [
        advanceDate,
        `Staff advance - ${employeeName}`,
        `ADV-${advanceId}`,
        staffAdvancesAcctId,
        paymentAccountId,
        amount,
        perm.staff.id,
        advanceId,
      ],
    );
    const transactionId = Number(txnRows[0].id);

    // Link transaction back to advance
    await sql(
      `UPDATE employee_advances SET transaction_id = $1 WHERE id = $2`,
      [transactionId, advanceId],
    );

    return Response.json(
      { success: true, advance_id: advanceId, transaction_id: transactionId },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/payroll/advances error", error);
    return Response.json({ error: "Failed to record advance" }, { status: 500 });
  }
}
