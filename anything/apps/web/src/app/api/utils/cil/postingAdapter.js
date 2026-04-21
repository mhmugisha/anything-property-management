import sql from "@/app/api/utils/sql";
import { writeAuditLog } from "@/app/api/utils/staff";
import { ensureCanCreditAccount } from "@/app/api/utils/accounting";
import { discoverAccountingModel } from "./discovery";
import { resolveAccountIntent } from "./bindings";
import { safeIdentifier } from "./sanitize";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function cleanText(value) {
  const s = String(value || "").trim();
  return s || null;
}

// Normalize any date-ish input into YYYY-MM-DD (required for Postgres ::date casts).
// Important: Date objects stringify to "Wed Oct ..." which Postgres rejects.
function normalizeDateOnly(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s) return null;

  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) {
    return s.slice(0, 10);
  }

  // dd-mm-yyyy (some UI surfaces display this)
  if (/^\d{2}-\d{2}-\d{4}$/.test(s.slice(0, 10))) {
    const dd = s.slice(0, 2);
    const mm = s.slice(3, 5);
    const yyyy = s.slice(6, 10);
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: anything parseable by Date
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function postAccountingEntryFromIntents({
  transactionDate,
  description,
  referenceNumber,
  debitIntent,
  creditIntent,
  amount,
  currency,
  createdBy,
  landlordId,
  propertyId,
  expenseScope,
  sourceType,
  sourceId,
  approvalStatus = 'approved',
  auditContext,
} = {}) {
  const model = await discoverAccountingModel();
  if (!model.ok) {
    return { ok: false, status: 500, error: model.error || "Discovery failed" };
  }

  const tx = model.transactions;

  const txDate = normalizeDateOnly(transactionDate);
  const descr = cleanText(description);
  const ref = referenceNumber !== undefined ? cleanText(referenceNumber) : null;
  const srcType = sourceType !== undefined ? cleanText(sourceType) : null;

  const amt = toNumber(amount);
  const curr = cleanText(currency) || "UGX";

  if (!txDate || !descr || !debitIntent || !creditIntent || !amt) {
    const dateHint = transactionDate ? String(transactionDate) : null;
    return {
      ok: false,
      status: 400,
      error:
        "transactionDate, description, debitIntent, creditIntent, amount are required",
      details: dateHint ? { transactionDate: dateHint } : undefined,
    };
  }

  if (amt <= 0) {
    return { ok: false, status: 400, error: "Amount must be > 0" };
  }

  const debitRes = await resolveAccountIntent(debitIntent);
  if (!debitRes.ok) {
    return { ok: false, status: 400, error: debitRes.error };
  }

  const creditRes = await resolveAccountIntent(creditIntent);
  if (!creditRes.ok) {
    return { ok: false, status: 400, error: creditRes.error };
  }

  const debitAccountId = toNumber(debitRes.accountId);
  const creditAccountId = toNumber(creditRes.accountId);

  if (!debitAccountId || !creditAccountId) {
    return { ok: false, status: 400, error: "Could not resolve accounts" };
  }

  if (debitAccountId === creditAccountId) {
    return {
      ok: false,
      status: 400,
      error: "Debit and credit accounts must be different",
    };
  }

  // Guard against reducing an Asset account below zero.
  const guard = await ensureCanCreditAccount({
    creditAccountId,
    amount: amt,
  });

  if (!guard.ok) {
    return {
      ok: false,
      status: guard.status || 400,
      error: guard.body?.error || "Insufficient funds",
      details: guard.body,
    };
  }

  // Dynamic column names (discovery-based)
  const table = safeIdentifier(tx.table);
  const pkCol = safeIdentifier(tx.pk || "id");

  const colDate = safeIdentifier(tx.date || "transaction_date");
  const colDesc = safeIdentifier(tx.description || "description");
  const colRef = safeIdentifier(tx.reference || "reference_number");
  const colDebit = safeIdentifier(tx.debitAccountId || "debit_account_id");
  const colCredit = safeIdentifier(tx.creditAccountId || "credit_account_id");
  const colAmount = safeIdentifier(tx.amount || "amount");
  const colCurrency = safeIdentifier(tx.currency || "currency");
  const colCreatedBy = tx.createdBy ? safeIdentifier(tx.createdBy) : null;
  const colLandlordId = tx.landlordId ? safeIdentifier(tx.landlordId) : null;
  const colPropertyId = tx.propertyId ? safeIdentifier(tx.propertyId) : null;
  const colExpenseScope = tx.expenseScope
    ? safeIdentifier(tx.expenseScope)
    : null;
  const colSourceType = tx.sourceType ? safeIdentifier(tx.sourceType) : null;
  const colSourceId = tx.sourceId ? safeIdentifier(tx.sourceId) : null;
  const colIsDeleted = tx.isDeleted ? safeIdentifier(tx.isDeleted) : null;
  const colDeletedAt = tx.deletedAt ? safeIdentifier(tx.deletedAt) : null;
  const colDeletedBy = tx.deletedBy ? safeIdentifier(tx.deletedBy) : null;

  const createdByNum = createdBy !== undefined ? toNumber(createdBy) : null;
  const landlordNum = landlordId !== undefined ? toNumber(landlordId) : null;
  const propertyNum = propertyId !== undefined ? toNumber(propertyId) : null;
  const sourceIdNum = sourceId !== undefined ? toNumber(sourceId) : null;

  const hasIdempotency = Boolean(ref && srcType && colSourceType && colRef);

  let saved = null;

  // Upsert-like behavior (update existing by source_type+reference_number; otherwise insert)
  if (hasIdempotency) {
    const existing = await sql(
      `
        SELECT *
        FROM ${table}
        WHERE ${colSourceType} = $1
          AND ${colRef} = $2
        LIMIT 1
      `,
      [srcType, ref],
    );

    const existingRow = existing?.[0] || null;
    const existingPk = existingRow ? toNumber(existingRow[pkCol]) : null;

    if (existingRow && existingPk) {
      const set = [];
      const values = [];

      set.push(`${colDate} = $${values.length + 1}::date`);
      values.push(txDate);

      set.push(`${colDesc} = $${values.length + 1}`);
      values.push(descr);

      set.push(`${colDebit} = $${values.length + 1}`);
      values.push(debitAccountId);

      set.push(`${colCredit} = $${values.length + 1}`);
      values.push(creditAccountId);

      set.push(`${colAmount} = $${values.length + 1}`);
      values.push(amt);

      set.push(`${colCurrency} = $${values.length + 1}`);
      values.push(curr);

      if (colCreatedBy) {
        set.push(`${colCreatedBy} = $${values.length + 1}`);
        values.push(createdByNum);
      }

      if (colLandlordId) {
        set.push(`${colLandlordId} = $${values.length + 1}`);
        values.push(landlordNum);
      }

      if (colPropertyId) {
        set.push(`${colPropertyId} = $${values.length + 1}`);
        values.push(propertyNum);
      }

      if (colExpenseScope) {
        set.push(`${colExpenseScope} = $${values.length + 1}`);
        values.push(expenseScope ? String(expenseScope) : null);
      }

      if (colSourceId) {
        set.push(`${colSourceId} = $${values.length + 1}`);
        values.push(sourceIdNum);
      }

      if (colIsDeleted) {
        set.push(`${colIsDeleted} = false`);
      }

      if (colDeletedAt) {
        set.push(`${colDeletedAt} = NULL`);
      }

      if (colDeletedBy) {
        set.push(`${colDeletedBy} = NULL`);
      }

      values.push(existingPk);

      const updated = await sql(
        `
          UPDATE ${table}
          SET ${set.join(", ")}
          WHERE ${pkCol} = $${values.length}
          RETURNING *
        `,
        values,
      );

      saved = updated?.[0] || null;

      await writeAuditLog({
        staffId: createdByNum,
        action: "cil.accounting.upsert",
        entityType: "transaction",
        entityId: saved?.[pkCol] || null,
        oldValues: existingRow,
        newValues: {
          ...saved,
          cil: {
            debitIntent,
            creditIntent,
            resolved: { debit: debitRes, credit: creditRes },
            posting: "update",
            source: auditContext || null,
          },
        },
        ipAddress: null,
      });

      return { ok: true, transaction: saved, posting: "update" };
    }
  }

  // Insert new
  const cols = [
    colDate,
    colDesc,
    colRef,
    colDebit,
    colCredit,
    colAmount,
    colCurrency,
  ];
  const values = [
    txDate,
    descr,
    ref,
    debitAccountId,
    creditAccountId,
    amt,
    curr,
  ];

  if (colCreatedBy) {
    cols.push(colCreatedBy);
    values.push(createdByNum);
  }

  if (colLandlordId) {
    cols.push(colLandlordId);
    values.push(landlordNum);
  }

  if (colPropertyId) {
    cols.push(colPropertyId);
    values.push(propertyNum);
  }

  if (colExpenseScope) {
    cols.push(colExpenseScope);
    values.push(expenseScope ? String(expenseScope) : null);
  }

  if (colSourceType) {
    cols.push(colSourceType);
    values.push(srcType);
  }

  if (colSourceId) {
    cols.push(colSourceId);
    values.push(sourceIdNum);
  }

  if (colIsDeleted) {
    cols.push(colIsDeleted);
    values.push(false);
  }

  cols.push('approval_status');
  values.push(approvalStatus || 'approved');

  const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");

  const inserted = await sql(
    `
      INSERT INTO ${table} (${cols.join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `,
    values,
  );

  saved = inserted?.[0] || null;

  await writeAuditLog({
    staffId: createdByNum,
    action: "cil.accounting.upsert",
    entityType: "transaction",
    entityId: saved?.[pkCol] || null,
    oldValues: null,
    newValues: {
      ...saved,
      cil: {
        debitIntent,
        creditIntent,
        resolved: { debit: debitRes, credit: creditRes },
        posting: "insert",
        source: auditContext || null,
      },
    },
    ipAddress: null,
  });

  return { ok: true, transaction: saved, posting: "insert" };
}

export async function softDeleteBySourceAndRefs({
  sourceType,
  keepReferences,
  restrictToReferences,
} = {}) {
  const srcType = cleanText(sourceType);
  const keep = Array.isArray(keepReferences)
    ? keepReferences.map((r) => cleanText(r)).filter(Boolean)
    : [];
  const restrict = Array.isArray(restrictToReferences)
    ? restrictToReferences.map((r) => cleanText(r)).filter(Boolean)
    : null;

  if (!srcType) {
    return { ok: false, status: 400, error: "sourceType is required" };
  }

  const model = await discoverAccountingModel();
  if (!model.ok) {
    return { ok: false, status: 500, error: model.error || "Discovery failed" };
  }

  const tx = model.transactions;
  const table = safeIdentifier(tx.table);

  if (!tx.sourceType || !tx.reference || !tx.isDeleted) {
    return {
      ok: false,
      status: 500,
      error: "Transactions table missing required metadata columns",
    };
  }

  const colSourceType = safeIdentifier(tx.sourceType);
  const colRef = safeIdentifier(tx.reference);
  const colIsDeleted = safeIdentifier(tx.isDeleted);
  const colDeletedAt = tx.deletedAt ? safeIdentifier(tx.deletedAt) : null;
  const colDeletedBy = tx.deletedBy ? safeIdentifier(tx.deletedBy) : null;

  const where = [
    `${colSourceType} = $1`,
    `COALESCE(${colIsDeleted}, false) = false`,
  ];
  const values = [srcType];

  if (restrict && restrict.length > 0) {
    where.push(`${colRef} = ANY($${values.length + 1})`);
    values.push(restrict);
  }

  if (keep.length > 0) {
    where.push(`NOT (${colRef} = ANY($${values.length + 1}))`);
    values.push(keep);
  }

  const setParts = [`${colIsDeleted} = true`];
  if (colDeletedAt) setParts.push(`${colDeletedAt} = now()`);
  if (colDeletedBy) setParts.push(`${colDeletedBy} = NULL`);

  const result = await sql(
    `
      WITH upd AS (
        UPDATE ${table}
        SET ${setParts.join(", ")}
        WHERE ${where.join(" AND ")}
        RETURNING 1
      )
      SELECT COUNT(*)::int AS deleted_count FROM upd
    `,
    values,
  );

  return { ok: true, deletedCount: Number(result?.[0]?.deleted_count || 0) };
}
