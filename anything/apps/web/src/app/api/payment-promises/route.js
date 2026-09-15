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

function mapRow(r) {
  return {
    id: Number(r.id),
    tenant_id: Number(r.tenant_id),
    promise_date: r.promise_date,
    amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
    comment: r.comment,
    recorded_by:
      r.recorded_by === null || r.recorded_by === undefined
        ? null
        : Number(r.recorded_by),
    recorded_by_name: r.recorded_by_name || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function GET(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = toNumber(searchParams.get("tenant_id"));
    if (!tenantId) {
      return Response.json({ error: "tenant_id is required" }, { status: 400 });
    }

    const rows = await sql(
      `SELECT
         pp.id, pp.tenant_id, pp.promise_date, pp.amount, pp.comment,
         pp.recorded_by, pp.created_at, pp.updated_at,
         su.full_name AS recorded_by_name
       FROM payment_promises pp
       LEFT JOIN staff_users su ON su.id = pp.recorded_by
       WHERE pp.tenant_id = $1
       ORDER BY pp.created_at DESC, pp.id DESC`,
      [tenantId],
    );

    return Response.json({ promises: rows.map(mapRow) });
  } catch (error) {
    console.error("GET /api/payment-promises error", error);
    return Response.json(
      { error: "Failed to fetch payment promises" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = toNumber(body?.tenant_id);
    const promiseDate = parseDate(body?.promise_date);
    const comment = String(body?.comment || "").trim();

    const rawAmount = body?.amount;
    let amount = null;
    if (rawAmount !== undefined && rawAmount !== null && rawAmount !== "") {
      amount = toNumber(rawAmount);
      if (amount === null || amount <= 0) {
        return Response.json(
          { error: "amount must be a positive number when provided" },
          { status: 400 },
        );
      }
    }

    if (!tenantId) {
      return Response.json({ error: "tenant_id is required" }, { status: 400 });
    }
    if (!promiseDate) {
      return Response.json(
        { error: "promise_date must be YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (!comment) {
      return Response.json({ error: "comment is required" }, { status: 400 });
    }

    const rows = await sql(
      `INSERT INTO payment_promises
         (tenant_id, promise_date, amount, comment, recorded_by)
       VALUES ($1, $2::date, $3, $4, $5)
       RETURNING id, tenant_id, promise_date, amount, comment,
                 recorded_by, created_at, updated_at`,
      [tenantId, promiseDate, amount, comment, perm.staff.id],
    );

    return Response.json({ promise: mapRow(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/payment-promises error", error);
    return Response.json(
      { error: "Failed to create payment promise" },
      { status: 500 },
    );
  }
}
