import sql from "@/app/api/utils/sql";
import { safeIdentifier } from "./sanitize";

let cached = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

function scoreAccountsTable(columns) {
  const colSet = new Set(columns);
  let score = 0;

  const has = (name) => colSet.has(name);
  const like = (substr) => columns.some((c) => c.includes(substr));

  if (has("account_name") || like("account_name")) score += 3;
  if (has("account_type") || like("account_type")) score += 3;
  if (has("account_code") || like("account_code")) score += 2;
  if (has("is_active") || like("is_active")) score += 1;

  // Common in COA tables
  if (like("parent")) score += 0.5;

  return score;
}

function scoreTransactionsTable(columns) {
  const colSet = new Set(columns);
  let score = 0;

  const has = (name) => colSet.has(name);
  const like = (substr) => columns.some((c) => c.includes(substr));

  if (has("debit_account_id") || like("debit_account")) score += 3;
  if (has("credit_account_id") || like("credit_account")) score += 3;
  if (has("amount") || like("amount")) score += 3;
  if (has("transaction_date") || like("date")) score += 2;
  if (has("description") || like("descr")) score += 1;
  if (has("reference_number") || like("reference")) score += 1;

  return score;
}

async function listPublicTables() {
  const rows = await sql(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `,
    [],
  );

  return (rows || []).map((r) => String(r.table_name));
}

async function getColumns(tableName) {
  const rows = await sql(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position ASC
    `,
    [tableName],
  );

  return (rows || []).map((r) => String(r.column_name));
}

async function getPrimaryKeyColumn(tableName) {
  const rows = await sql(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE i.indisprimary = true
        AND n.nspname = 'public'
        AND c.relname = $1
      ORDER BY a.attnum ASC
      LIMIT 1
    `,
    [tableName],
  );
  return rows?.[0]?.column_name ? String(rows[0].column_name) : null;
}

function pickColumn(columns, candidates) {
  const set = new Set(columns);
  for (const c of candidates) {
    if (set.has(c)) return c;
  }
  return null;
}

export async function discoverAccountingModel({ force = false } = {}) {
  const now = Date.now();
  if (!force && cached && now - cachedAt < CACHE_MS) {
    return cached;
  }

  const tables = await listPublicTables();

  const meta = [];
  for (const t of tables) {
    const cols = await getColumns(t);
    meta.push({ table: t, columns: cols });
  }

  const accountCandidates = meta
    .map((m) => ({ ...m, score: scoreAccountsTable(m.columns) }))
    .sort((a, b) => b.score - a.score);

  const transactionCandidates = meta
    .map((m) => ({ ...m, score: scoreTransactionsTable(m.columns) }))
    .sort((a, b) => b.score - a.score);

  const accountsTable =
    accountCandidates?.[0]?.score >= 4 ? accountCandidates[0] : null;
  const transactionsTable =
    transactionCandidates?.[0]?.score >= 7 ? transactionCandidates[0] : null;

  if (!accountsTable || !transactionsTable) {
    cached = {
      ok: false,
      error: "Could not discover accounting storage tables",
      accountsTable: accountsTable?.table || null,
      transactionsTable: transactionsTable?.table || null,
    };
    cachedAt = now;
    return cached;
  }

  const accountsPk = await getPrimaryKeyColumn(accountsTable.table);
  const transactionsPk = await getPrimaryKeyColumn(transactionsTable.table);

  const accountsColumns = accountsTable.columns;
  const transactionsColumns = transactionsTable.columns;

  const model = {
    ok: true,
    accounts: {
      table: safeIdentifier(accountsTable.table),
      pk: accountsPk ? safeIdentifier(accountsPk) : null,
      code: pickColumn(accountsColumns, ["account_code", "code", "acct_code"]),
      name: pickColumn(accountsColumns, ["account_name", "name", "acct_name"]),
      type: pickColumn(accountsColumns, ["account_type", "type", "acct_type"]),
      isActive: pickColumn(accountsColumns, ["is_active", "active", "enabled"]),
    },
    transactions: {
      table: safeIdentifier(transactionsTable.table),
      pk: transactionsPk ? safeIdentifier(transactionsPk) : null,
      date: pickColumn(transactionsColumns, ["transaction_date", "date"]),
      description: pickColumn(transactionsColumns, [
        "description",
        "memo",
        "narration",
      ]),
      reference: pickColumn(transactionsColumns, [
        "reference_number",
        "reference",
        "ref",
      ]),
      debitAccountId: pickColumn(transactionsColumns, [
        "debit_account_id",
        "debit_account",
        "dr_account_id",
      ]),
      creditAccountId: pickColumn(transactionsColumns, [
        "credit_account_id",
        "credit_account",
        "cr_account_id",
      ]),
      amount: pickColumn(transactionsColumns, ["amount", "value"]),
      currency: pickColumn(transactionsColumns, ["currency"]),
      createdBy: pickColumn(transactionsColumns, [
        "created_by",
        "createdBy",
        "created_user",
      ]),
      landlordId: pickColumn(transactionsColumns, ["landlord_id"]),
      propertyId: pickColumn(transactionsColumns, ["property_id"]),
      expenseScope: pickColumn(transactionsColumns, ["expense_scope"]),
      sourceType: pickColumn(transactionsColumns, ["source_type"]),
      sourceId: pickColumn(transactionsColumns, ["source_id"]),
      isDeleted: pickColumn(transactionsColumns, ["is_deleted"]),
      deletedAt: pickColumn(transactionsColumns, ["deleted_at"]),
      deletedBy: pickColumn(transactionsColumns, ["deleted_by"]),
    },
  };

  // Sanitize optional columns too
  for (const [k, v] of Object.entries(model.accounts)) {
    if (k === "table") continue;
    if (v) model.accounts[k] = safeIdentifier(v);
  }

  for (const [k, v] of Object.entries(model.transactions)) {
    if (k === "table") continue;
    if (v) model.transactions[k] = safeIdentifier(v);
  }

  cached = model;
  cachedAt = now;
  return model;
}
