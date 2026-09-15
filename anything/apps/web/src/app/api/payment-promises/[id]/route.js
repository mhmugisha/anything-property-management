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

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, "tenants");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const id = toNumber(params?.id);
    if (!id) {
      return Response.json({ error: "Invalid promise id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const fields = [];
    const values = [];

    if (body?.promise_date !== undefined) {
      const d = parseDate(body.promise_date);
      if (!d) {
        return Response.json(
          { error: "promise_date must be YYYY-MM-DD" },
          { status: 400 },
        );
      }
      fields.push(`promise_date = $${values.length + 1}::date`);
      values.push(d);
    }

    if (body?.amount !== undefined) {
      if (body.amount === null || body.amount === "") {
        fields.push(`amount = NULL`);
      } else {
        const a = toNumber(body.amount);
        if (a === null || a <= 0) {
          return Response.json(
            { error: "amount must be a positive number when provided" },
            { status: 400 },
          );
        }
        fields.push(`amount = $${values.length + 1}`);
        values.push(a);
      }
    }

    if (body?.comment !== undefined) {
      const c = String(body.comment || "").trim();
      if (!c) {
        return Response.json(
          { error: "comment cannot be empty" },
          { status: 400 },
        );
      }
      fields.push(`comment = $${values.length + 1}`);
      values.push(c);
    }

    if (fields.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const rows = await sql(
      `UPDATE payment_promises
         SET ${fields.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, tenant_id, promise_date, amount, comment,
                 recorded_by, created_at, updated_at`,
      values,
    );

    if (!rows.length) {
      return Response.json({ error: "Promise not found" }, { status: 404 });
    }

    const r = rows[0];
    return Response.json({
      promise: {
        id: Number(r.id),
        tenant_id: Number(r.tenant_id),
        promise_date: r.promise_date,
        amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
        comment: r.comment,
        recorded_by:
          r.recorded_by === null || r.recorded_by === undefined
            ? null
            : Number(r.recorded_by),
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
    });
  } catch (error) {
    console.error("PUT /api/payment-promises/[id] error", error);
    return Response.json(
      { error: "Failed to update payment promise" },
      { status: 500 },
    );
  }
}
