import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { getApprovalFields, getApprovalStatus } from "@/app/api/utils/approval";

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

  // dd-mm-yyyy (from UI display)
  if (/^\d{2}-\d{2}-\d{4}$/.test(s.slice(0, 10))) {
    const dd = s.slice(0, 2);
    const mm = s.slice(3, 5);
    const yyyy = s.slice(6, 10);
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export async function GET(request) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const includeArchived =
      (searchParams.get("includeArchived") || "").trim() === "1";

    const like = `%${search}%`;

    const landlords = await sql(
      `
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
        WHERE 1=1
          ${includeArchived ? "" : "AND COALESCE(status, 'active') = 'active'"}
          AND (
            $1::text = ''
            OR LOWER(full_name) LIKE LOWER($2)
            OR LOWER(COALESCE(title,'')) LIKE LOWER($2)
            OR phone LIKE $2
            OR LOWER(COALESCE(email,'')) LIKE LOWER($2)
          )
        ORDER BY full_name
        LIMIT 500
      `,
      [search, like],
    );

    return Response.json({ landlords });
  } catch (error) {
    console.error("GET /api/landlords error", error);
    return Response.json(
      { error: "Failed to fetch landlords" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json();

    const rawTitle = (body?.title || "").trim();
    const title = rawTitle
      ? ALLOWED_TITLES.has(rawTitle)
        ? rawTitle
        : null
      : null;
    const fullName = (body?.full_name || "").trim();
    const phone = (body?.phone || "").trim() || null;
    const email = (body?.email || "").trim() || null;

    const paymentMethodRaw = normalizePaymentMethod(body?.payment_method);
    if (paymentMethodRaw === "__invalid__") {
      return Response.json(
        { error: "Invalid payment_method. Use 'bank' or 'mobile_money'." },
        { status: 400 },
      );
    }

    // For CREATE: if the key isn't provided, treat it as NULL in the DB.
    const paymentMethod =
      paymentMethodRaw === undefined ? null : paymentMethodRaw;

    const bankName = (body?.bank_name || "").trim() || null;
    const bankAccountTitle = (body?.bank_account_title || "").trim() || null;
    const bankAccountNumber = (body?.bank_account_number || "").trim() || null;

    const mobileMoneyName = (body?.mobile_money_name || "").trim() || null;
    const mobileMoneyPhone = (body?.mobile_money_phone || "").trim() || null;

    const bankNameToSave = paymentMethod === "bank" ? bankName : null;
    const bankAccountTitleToSave =
      paymentMethod === "bank" ? bankAccountTitle : null;
    const bankAccountNumberToSave =
      paymentMethod === "bank" ? bankAccountNumber : null;

    const mobileMoneyNameToSave =
      paymentMethod === "mobile_money" ? mobileMoneyName : null;
    const mobileMoneyPhoneToSave =
      paymentMethod === "mobile_money" ? mobileMoneyPhone : null;

    if (paymentMethod === "bank") {
      if (
        !bankNameToSave ||
        !bankAccountTitleToSave ||
        !bankAccountNumberToSave
      ) {
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
      if (!mobileMoneyNameToSave || !mobileMoneyPhoneToSave) {
        return Response.json(
          {
            error:
              "For Mobile Money payment method, mobile_money_name and mobile_money_phone are required.",
          },
          { status: 400 },
        );
      }
    }

    const dueDayRaw = body?.due_day;
    const dueDateRaw = typeof body?.due_date === "string" ? body.due_date : "";
    const anchoredDueDate =
      dueDayRaw !== undefined && dueDayRaw !== null
        ? normalizeDueDateFromDay(dueDayRaw)
        : normalizeDueDateFromDateString(dueDateRaw);

    const startDate = normalizeDateInput(body?.start_date);
    const endDate = normalizeDateInput(body?.end_date);

    if (!fullName) {
      return Response.json({ error: "full_name is required" }, { status: 400 });
    }

    const approval = getApprovalFields(perm.staff);
    const rows = await sql`
      INSERT INTO landlords (
        title,
        full_name,
        phone,
        email,
        due_date,
        start_date,
        end_date,
        status,
        payment_method,
        bank_name,
        bank_account_title,
        bank_account_number,
        mobile_money_name,
        mobile_money_phone,
        approval_status, approved_by, approved_at,
        created_by
      )
      VALUES (
        ${title},
        ${fullName},
        ${phone},
        ${email},
        ${anchoredDueDate}::date,
        ${startDate}::date,
        ${endDate}::date,
        CASE
          WHEN ${endDate}::date IS NOT NULL AND CURRENT_DATE > ${endDate}::date THEN 'ended'
          ELSE 'active'
        END,
        ${paymentMethod},
        ${bankNameToSave},
        ${bankAccountTitleToSave},
        ${bankAccountNumberToSave},
        ${mobileMoneyNameToSave},
        ${mobileMoneyPhoneToSave},
        ${approval.approval_status}, ${approval.approved_by}, ${approval.approved_at},
        ${perm.staff.id}
      )
      RETURNING
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
    `;

    const landlord = rows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.create",
      entityType: "landlord",
      entityId: landlord?.id || null,
      oldValues: null,
      newValues: landlord,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ landlord });
  } catch (error) {
    console.error("POST /api/landlords error", error);
    return Response.json(
      { error: "Failed to create landlord" },
      { status: 500 },
    );
  }
}
