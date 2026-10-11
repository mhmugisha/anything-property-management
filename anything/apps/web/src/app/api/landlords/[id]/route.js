import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { countActiveLeasesForLandlord } from "@/app/api/utils/landlordLeases";

const ALLOWED_TITLES = new Set(["Mr.", "Ms.", "Dr."]);
const ALLOWED_PAYMENT_METHODS = new Set(["bank", "mobile_money"]);

function normalizePaymentMethod(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (!ALLOWED_PAYMENT_METHODS.has(s)) return "__invalid__";
  return s;
}

function toNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeDueDateFromDay(dueDay) {
  const n = Number(dueDay);
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  const dd = String(n).padStart(2, "0");
  return `2000-01-${dd}`;
}

function normalizeDueDateFromDateString(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (s.length < 10) return null;
  const day = Number(s.slice(8, 10));
  return normalizeDueDateFromDay(day);
}

function normalizeDateInput(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (s.length < 10) return null;

  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) {
    return s.slice(0, 10);
  }

  // dd-mm-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(s.slice(0, 10))) {
    const dd = s.slice(0, 2);
    const mm = s.slice(3, 5);
    const yyyy = s.slice(6, 10);
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const id = toNumber(params?.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const rows = await sql`
      SELECT
        id,
        title,
        full_name,
        phone,
        email,
        due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day,
        start_date,
        end_date,
        payment_method,
        bank_name,
        bank_account_title,
        bank_account_number,
        mobile_money_name,
        mobile_money_phone,
        COALESCE(status, 'active') AS status,
        created_at
      FROM landlords
      WHERE id = ${id}
      LIMIT 1
    `;

    const landlord = rows?.[0] || null;
    if (!landlord)
      return Response.json({ error: "Not found" }, { status: 404 });

    return Response.json({ landlord });
  } catch (error) {
    console.error("GET /api/landlords/[id] error", error);
    return Response.json(
      { error: "Failed to fetch landlord" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const id = toNumber(params?.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const oldRows = await sql`
      SELECT
        id,
        title,
        full_name,
        phone,
        email,
        due_date,
        start_date,
        end_date,
        payment_method,
        bank_name,
        bank_account_title,
        bank_account_number,
        mobile_money_name,
        mobile_money_phone,
        COALESCE(status, 'active') AS status
      FROM landlords
      WHERE id = ${id}
      LIMIT 1
    `;

    const oldLandlord = oldRows?.[0] || null;
    if (!oldLandlord)
      return Response.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const rawTitle =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    const title =
      rawTitle === undefined
        ? undefined
        : rawTitle
          ? ALLOWED_TITLES.has(rawTitle)
            ? rawTitle
            : null
          : null;

    const fullName =
      typeof body?.full_name === "string" ? body.full_name.trim() : undefined;
    const phone =
      typeof body?.phone === "string" ? body.phone.trim() : undefined;
    const email =
      typeof body?.email === "string" ? body.email.trim() : undefined;

    const dueDayRaw = body?.due_day;
    const dueDateRaw =
      typeof body?.due_date === "string" ? body.due_date : undefined;
    const anchoredDueDate =
      dueDayRaw !== undefined
        ? normalizeDueDateFromDay(dueDayRaw)
        : dueDateRaw !== undefined
          ? normalizeDueDateFromDateString(dueDateRaw)
          : undefined;

    const startDate =
      body?.start_date !== undefined
        ? normalizeDateInput(body?.start_date)
        : undefined;
    const endDate =
      body?.end_date !== undefined
        ? normalizeDateInput(body?.end_date)
        : undefined;

    const paymentMethod =
      body?.payment_method !== undefined
        ? normalizePaymentMethod(body?.payment_method)
        : undefined;

    if (paymentMethod === "__invalid__") {
      return Response.json(
        { error: "Invalid payment_method. Use 'bank' or 'mobile_money'." },
        { status: 400 },
      );
    }

    const bankName =
      typeof body?.bank_name === "string" ? body.bank_name.trim() : undefined;
    const bankAccountTitle =
      typeof body?.bank_account_title === "string"
        ? body.bank_account_title.trim()
        : undefined;
    const bankAccountNumber =
      typeof body?.bank_account_number === "string"
        ? body.bank_account_number.trim()
        : undefined;

    const mobileMoneyName =
      typeof body?.mobile_money_name === "string"
        ? body.mobile_money_name.trim()
        : undefined;
    const mobileMoneyPhone =
      typeof body?.mobile_money_phone === "string"
        ? body.mobile_money_phone.trim()
        : undefined;

    if (paymentMethod === "bank") {
      const bn = bankName ?? oldLandlord.bank_name;
      const bat = bankAccountTitle ?? oldLandlord.bank_account_title;
      const ban = bankAccountNumber ?? oldLandlord.bank_account_number;
      if (!bn || !bat || !ban) {
        return Response.json(
          {
            error:
              "For Bank payment method, bank_name, bank_account_title and bank_account_number are required.",
          },
          { status: 400 },
        );
      }
    }

    if (paymentMethod === "mobile_money") {
      const mn = mobileMoneyName ?? oldLandlord.mobile_money_name;
      const mp = mobileMoneyPhone ?? oldLandlord.mobile_money_phone;
      if (!mn || !mp) {
        return Response.json(
          {
            error:
              "For Mobile Money payment method, mobile_money_name and mobile_money_phone are required.",
          },
          { status: 400 },
        );
      }
    }

    const set = [];
    const values = [];

    if (title !== undefined) {
      set.push(`title = $${values.length + 1}`);
      values.push(title);
    }
    if (fullName !== undefined) {
      set.push(`full_name = $${values.length + 1}`);
      values.push(fullName);
    }
    if (phone !== undefined) {
      set.push(`phone = $${values.length + 1}`);
      values.push(phone || null);
    }
    if (email !== undefined) {
      set.push(`email = $${values.length + 1}`);
      values.push(email || null);
    }
    if (anchoredDueDate !== undefined) {
      set.push(`due_date = $${values.length + 1}::date`);
      values.push(anchoredDueDate || null);
    }
    if (startDate !== undefined) {
      set.push(`start_date = $${values.length + 1}::date`);
      values.push(startDate || null);
    }
    if (endDate !== undefined) {
      set.push(`end_date = $${values.length + 1}::date`);
      values.push(endDate || null);

      // If an end date is set in the past, mark the landlord as ended.
      set.push(
        `status = CASE WHEN $${values.length}::date IS NOT NULL AND CURRENT_DATE > $${values.length}::date THEN 'ended' ELSE COALESCE(status, 'active') END`,
      );
    }

    if (paymentMethod !== undefined) {
      set.push(`payment_method = $${values.length + 1}`);
      values.push(paymentMethod);

      if (paymentMethod === "bank") {
        set.push(`mobile_money_name = NULL`);
        set.push(`mobile_money_phone = NULL`);
      }
      if (paymentMethod === "mobile_money") {
        set.push(`bank_name = NULL`);
        set.push(`bank_account_title = NULL`);
        set.push(`bank_account_number = NULL`);
      }
      if (paymentMethod === null) {
        set.push(`bank_name = NULL`);
        set.push(`bank_account_title = NULL`);
        set.push(`bank_account_number = NULL`);
        set.push(`mobile_money_name = NULL`);
        set.push(`mobile_money_phone = NULL`);
      }
    }

    if (bankName !== undefined) {
      set.push(`bank_name = $${values.length + 1}`);
      values.push(bankName || null);
    }
    if (bankAccountTitle !== undefined) {
      set.push(`bank_account_title = $${values.length + 1}`);
      values.push(bankAccountTitle || null);
    }
    if (bankAccountNumber !== undefined) {
      set.push(`bank_account_number = $${values.length + 1}`);
      values.push(bankAccountNumber || null);
    }

    if (mobileMoneyName !== undefined) {
      set.push(`mobile_money_name = $${values.length + 1}`);
      values.push(mobileMoneyName || null);
    }
    if (mobileMoneyPhone !== undefined) {
      set.push(`mobile_money_phone = $${values.length + 1}`);
      values.push(mobileMoneyPhone || null);
    }

    if (set.length === 0) {
      return Response.json({ error: "No valid fields" }, { status: 400 });
    }

    // A past end date ends the landlord (see the status CASE above). That is
    // only allowed once no lease on their properties is active; leases are
    // ended one at a time through the tenant end-lease flow, never here.
    if (endDate && oldLandlord.status !== "ended") {
      const [{ ends }] =
        await sql`SELECT CURRENT_DATE > ${endDate}::date AS ends`;
      if (ends) {
        const activeCount = await countActiveLeasesForLandlord(id);
        if (activeCount > 0) {
          return Response.json(
            {
              error: `This landlord still has ${activeCount} active tenant lease(s). End all tenant leases before ending the landlord.`,
              active_lease_count: activeCount,
            },
            { status: 409 },
          );
        }
      }
    }

    const query = `UPDATE landlords SET ${set.join(", ")} WHERE id = $${values.length + 1} RETURNING id, title, full_name, phone, email, due_date, (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day, start_date, end_date, payment_method, bank_name, bank_account_title, bank_account_number, mobile_money_name, mobile_money_phone, COALESCE(status, 'active') AS status, created_at`;

    const updatedRows = await sql(query, [...values, id]);
    const landlord = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.update",
      entityType: "landlord",
      entityId: id,
      oldValues: oldLandlord,
      newValues: landlord,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ landlord });
  } catch (error) {
    console.error("PUT /api/landlords/[id] error", error);
    return Response.json(
      { error: "Failed to update landlord" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const oldRows = await sql`
      SELECT id, title, full_name, phone, email, due_date, start_date, end_date, COALESCE(status, 'active') AS status, created_at
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const oldLandlord = oldRows?.[0] || null;
    if (!oldLandlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    // Safety: only allow delete if landlord has no related data.
    const counts = await sql(
      `
        SELECT
          (SELECT COUNT(*)::int FROM properties WHERE landlord_id = $1) AS properties_count,
          (SELECT COUNT(*)::int FROM landlord_payouts WHERE landlord_id = $1) AS payouts_count,
          (SELECT COUNT(*)::int FROM landlord_deductions WHERE landlord_id = $1) AS deductions_count,
          (SELECT COUNT(*)::int FROM transactions WHERE landlord_id = $1) AS transactions_count
      `,
      [landlordId],
    );

    const c = counts?.[0] || {};
    const relatedTotal =
      Number(c.properties_count || 0) +
      Number(c.payouts_count || 0) +
      Number(c.deductions_count || 0) +
      Number(c.transactions_count || 0);

    if (relatedTotal > 0) {
      return Response.json(
        {
          error:
            "Cannot delete a landlord with related data (properties / payouts / deductions / transactions). Archive instead.",
        },
        { status: 400 },
      );
    }

    await sql`DELETE FROM landlords WHERE id = ${landlordId}`;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.delete",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: oldLandlord,
      newValues: null,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/landlords/[id] error", error);
    return Response.json(
      { error: "Failed to delete landlord" },
      { status: 500 },
    );
  }
}
