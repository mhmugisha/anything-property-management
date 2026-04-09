import sql from "@/app/api/utils/sql";
import { discoverAccountingModel } from "./discovery";
import { safeIdentifier } from "./sanitize";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeIntent(intent) {
  return String(intent || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function whereActiveSql(accounts) {
  if (!accounts?.isActive) return { clause: "", values: [] };
  const col = safeIdentifier(accounts.isActive);
  return { clause: ` AND COALESCE(${col}, true) = true`, values: [] };
}

async function getBoundAccountId(semanticKey) {
  const rows = await sql(
    "SELECT account_id FROM integration_account_bindings WHERE semantic_key = $1 LIMIT 1",
    [semanticKey],
  );
  const id = rows?.[0]?.account_id;
  return toNumber(id);
}

async function accountExistsAndActive({ model, accountId }) {
  const accounts = model.accounts;
  if (!accounts?.table || !accounts?.pk) return { ok: false };

  const table = safeIdentifier(accounts.table);
  const pk = safeIdentifier(accounts.pk);
  const activeCol = accounts.isActive
    ? safeIdentifier(accounts.isActive)
    : null;

  const cols = [pk];
  if (activeCol) cols.push(activeCol);

  const query = `SELECT ${cols.join(", ")} FROM ${table} WHERE ${pk} = $1 LIMIT 1`;
  const rows = await sql(query, [accountId]);
  const row = rows?.[0] || null;
  if (!row) return { ok: false };

  if (activeCol && row[activeCol] === false) {
    return { ok: false, inactive: true };
  }

  return { ok: true };
}

async function findByHeuristic({
  model,
  accountType,
  nameKeywords = [],
  codeValue,
}) {
  const accounts = model.accounts;
  if (!accounts?.table || !accounts?.pk) return null;

  const table = safeIdentifier(accounts.table);
  const pk = safeIdentifier(accounts.pk);

  const nameCol = accounts.name ? safeIdentifier(accounts.name) : null;
  const typeCol = accounts.type ? safeIdentifier(accounts.type) : null;
  const codeCol = accounts.code ? safeIdentifier(accounts.code) : null;

  const where = ["1=1"];
  const values = [];

  if (accountType && typeCol) {
    where.push(`${typeCol} = $${values.length + 1}`);
    values.push(String(accountType));
  }

  if (codeValue && codeCol) {
    where.push(`${codeCol} = $${values.length + 1}`);
    values.push(String(codeValue));
  }

  if (nameKeywords.length > 0 && nameCol) {
    const parts = [];
    for (const kw of nameKeywords) {
      parts.push(
        `LOWER(COALESCE(${nameCol}, '')) LIKE LOWER($${values.length + 1})`,
      );
      values.push(`%${String(kw)}%`);
    }
    where.push(`(${parts.join(" OR ")})`);
  }

  const active = whereActiveSql(accounts);

  const query = `
    SELECT ${pk} AS id
    FROM ${table}
    WHERE ${where.join(" AND ")}${active.clause}
    ORDER BY ${pk} ASC
    LIMIT 1
  `;

  const rows = await sql(query, values);
  const id = rows?.[0]?.id;
  return toNumber(id);
}

export async function resolveAccountIntent(intentRaw) {
  const intent = normalizeIntent(intentRaw);
  if (!intent) {
    return { ok: false, error: "Missing intent" };
  }

  const model = await discoverAccountingModel();
  if (!model.ok) {
    return { ok: false, error: model.error || "Accounting discovery failed" };
  }

  // 1) explicit binding (preferred)
  try {
    const boundId = await getBoundAccountId(intent);
    if (boundId) {
      const exists = await accountExistsAndActive({
        model,
        accountId: boundId,
      });
      if (exists.ok) {
        return { ok: true, accountId: boundId, method: "binding" };
      }

      return {
        ok: false,
        error: exists.inactive
          ? `Bound account for ${intent} is inactive`
          : `Bound account for ${intent} not found`,
      };
    }
  } catch (e) {
    console.error("resolveAccountIntent: binding lookup failed", e);
  }

  // 2) heuristic resolution
  const heuristics = {
    tenant_receivable: {
      type: "Asset",
      keywords: ["receivable", "accounts receivable", "rent receivable", "ar"],
      codeFallback: "1210",
    },
    tenant_prepayments: {
      type: "Liability",
      keywords: [
        "tenant prepayment",
        "prepayment",
        "unearned rent",
        "deferred rent",
        "advance payment",
      ],
      codeFallback: "2150",
    },
    landlord_liability: {
      type: "Liability",
      keywords: [
        "due to landlord",
        "due to landlords",
        "landlord",
        "rent payable",
      ],
      codeFallback: "2100",
    },
    undeposited_funds: {
      type: "Asset",
      keywords: ["undeposited", "clearing"],
      codeFallback: "1130",
    },
    management_fee_income: {
      type: "Income",
      keywords: ["management fee", "commission"],
      codeFallback: "4100",
    },
    cash_account: {
      type: "Asset",
      keywords: ["cash"],
      codeFallback: "1110",
    },
    bank_account: {
      type: "Asset",
      keywords: ["bank"],
      codeFallback: "1120",
    },
    cash_bank: {
      type: "Asset",
      keywords: ["bank", "cash"],
      codeFallback: null,
    },
  };

  const h = heuristics[intent] || null;

  if (h) {
    const byName = await findByHeuristic({
      model,
      accountType: h.type,
      nameKeywords: h.keywords,
      codeValue: null,
    });

    if (byName) {
      return { ok: true, accountId: byName, method: "heuristic" };
    }

    if (h.codeFallback && model.accounts.code) {
      const byCode = await findByHeuristic({
        model,
        accountType: null,
        nameKeywords: [],
        codeValue: h.codeFallback,
      });

      if (byCode) {
        return { ok: true, accountId: byCode, method: "code_fallback" };
      }
    }
  }

  return {
    ok: false,
    error: `Could not resolve account intent: ${intent}`,
  };
}

export async function listAccountBindings() {
  const rows = await sql(
    "SELECT semantic_key, account_id, updated_at FROM integration_account_bindings ORDER BY semantic_key ASC",
    [],
  );
  return rows || [];
}

export async function upsertAccountBinding({ semanticKey, accountId }) {
  const key = normalizeIntent(semanticKey);
  const id = toNumber(accountId);

  if (!key) {
    return {
      ok: false,
      status: 400,
      body: { error: "semantic_key is required" },
    };
  }

  // Allow setting NULL to clear a binding.
  if (accountId !== null && accountId !== undefined && !id) {
    return {
      ok: false,
      status: 400,
      body: { error: "account_id must be a number or null" },
    };
  }

  await sql(
    `
      INSERT INTO integration_account_bindings (semantic_key, account_id, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (semantic_key) DO UPDATE
      SET account_id = EXCLUDED.account_id,
          updated_at = now()
    `,
    [key, id],
  );

  return { ok: true, binding: { semantic_key: key, account_id: id } };
}
