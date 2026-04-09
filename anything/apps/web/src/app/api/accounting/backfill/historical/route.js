import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { discoverAccountingModel } from "@/app/api/utils/cil/discovery";
import { postAccountingEntryFromIntents } from "@/app/api/utils/cil/postingAdapter";
import { ensurePropertyAccrualLedgerViaCIL } from "@/app/api/utils/cil/propertyAccrualSync";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
// NOTE: do not import Node's `crypto` here; this route may run in runtimes where it is unavailable.

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

async function sha256(input) {
  const text = String(input);

  // Prefer WebCrypto (available in modern Node runtimes and edge runtimes).
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle?.digest) {
      const data = new TextEncoder().encode(text);
      const hashBuf = await subtle.digest("SHA-256", data);
      const bytes = new Uint8Array(hashBuf);
      let hex = "";
      for (const b of bytes) {
        hex += b.toString(16).padStart(2, "0");
      }
      return hex;
    }
  } catch (e) {
    console.error("sha256: subtle.digest failed", e);
  }

  // Fallback to Node crypto only if available.
  try {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(text).digest("hex");
  } catch (e) {
    console.error("sha256: crypto fallback failed", e);
  }

  // Last-resort deterministic fallback (keeps DB constraint happy, avoids throwing).
  // This is not cryptographically strong, but this hash is only used for idempotency metadata.
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const fallback = (h >>> 0).toString(16).padStart(8, "0");
  return fallback.padEnd(64, "0");
}

async function getBackfillStatusFlag() {
  const rows = await sql(
    `
      SELECT enabled
      FROM integration_feature_flags
      WHERE flag_name = $1
      LIMIT 1
    `,
    ["historical_backfill_completed"],
  );

  if (!rows?.length) return false;
  return rows[0].enabled === true;
}

async function setBackfillStatusFlag(enabled) {
  await sql(
    `
      INSERT INTO integration_feature_flags (flag_name, enabled)
      VALUES ($1, $2)
      ON CONFLICT (flag_name)
      DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
    `,
    ["historical_backfill_completed", enabled === true],
  );
}

async function getRegistryCount() {
  const countRows = await sql(
    `SELECT COUNT(*)::int AS n FROM backfill_registry`,
    [],
  );
  return Number(countRows?.[0]?.n || 0);
}

async function getTransactionsCount() {
  const rows = await sql(
    `SELECT COUNT(*)::int AS n FROM transactions WHERE COALESCE(is_deleted,false) = false`,
    [],
  );
  return Number(rows?.[0]?.n || 0);
}

async function validateRequiredIntents() {
  const intents = [
    "tenant_receivable",
    "landlord_liability",
    "management_fee_income",
    "undeposited_funds",
    "cash_account",
    "bank_account",
  ];

  const results = [];
  for (const intent of intents) {
    // eslint-disable-next-line no-await-in-loop
    const r = await resolveAccountIntent(intent);
    results.push({
      intent,
      ok: r.ok === true,
      accountId: r.accountId || null,
      method: r.method || null,
      error: r.error || null,
    });
  }

  const missing = results.filter((r) => !r.ok).map((r) => r.intent);
  return { ok: missing.length === 0, missing, results };
}

async function getRegistryRow(sourceType, sourceEventId) {
  const rows = await sql(
    `
      SELECT *
      FROM backfill_registry
      WHERE source_type = $1
        AND source_event_id = $2
      LIMIT 1
    `,
    [sourceType, String(sourceEventId)],
  );

  return rows?.[0] || null;
}

async function insertRegistryRow({
  sourceType,
  sourceEventId,
  accountingTxId,
  hash,
}) {
  await sql(
    `
      INSERT INTO backfill_registry (source_type, source_event_id, accounting_tx_id, hash)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source_type, source_event_id)
      DO NOTHING
    `,
    [
      sourceType,
      String(sourceEventId),
      accountingTxId ? String(accountingTxId) : null,
      hash,
    ],
  );
}

async function findExistingTxBySource({ model, sourceType, sourceId }) {
  const tx = model.transactions;
  if (!tx.sourceType || !tx.sourceId) return null;

  const where = [`${tx.sourceType} = $1`, `${tx.sourceId} = $2`];
  const values = [String(sourceType), Number(sourceId)];

  if (tx.isDeleted) {
    where.push(`COALESCE(${tx.isDeleted}, false) = false`);
  }

  const rows = await sql(
    `
      SELECT *
      FROM ${tx.table}
      WHERE ${where.join(" AND ")}
      ORDER BY ${tx.pk || "id"} DESC
      LIMIT 1
    `,
    values,
  );

  return rows?.[0] || null;
}

export async function GET(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const completedFlag = await getBackfillStatusFlag();
    const n = await getRegistryCount();
    const txCount = await getTransactionsCount();

    // If a previous run was incorrectly marked completed but posted nothing,
    // report it as not completed so the UI encourages a rerun.
    const completed = completedFlag && (n > 0 || txCount > 0);

    return Response.json({
      ok: true,
      completed,
      completedFlag,
      registryCount: n,
      transactionsCount: txCount,
    });
  } catch (error) {
    console.error("GET /api/accounting/backfill/historical error", error);
    return Response.json(
      { error: "Failed to fetch backfill status" },
      { status: 500 },
    );
  }
}

function normalizeDateOnly(value) {
  if (value === null || value === undefined || value === "") return null;

  // Already in YYYY-MM-DD.
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Accept Date instances or any parseable string.
  try {
    const d = value instanceof Date ? value : new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return null;
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const body = await request.json().catch(() => ({}));

    const dryRun = body?.dryRun === true;
    const force = body?.force === true;

    const fromRaw = cleanText(body?.from);
    const toRaw = cleanText(body?.to);

    const from = normalizeDateOnly(fromRaw);
    const to = normalizeDateOnly(toRaw);

    if (fromRaw && !from) {
      return Response.json(
        { error: `Invalid 'from' date: ${String(fromRaw)}` },
        { status: 400 },
      );
    }

    if (toRaw && !to) {
      return Response.json(
        { error: `Invalid 'to' date: ${String(toRaw)}` },
        { status: 400 },
      );
    }

    const includePayments = body?.includePayments !== false;
    const includePayouts = body?.includePayouts !== false;
    const includeDeductions = body?.includeDeductions !== false;

    const alreadyCompleted = await getBackfillStatusFlag();
    const registryCount = await getRegistryCount();
    const transactionsCount = await getTransactionsCount();

    // If a prior run was mistakenly marked completed but posted nothing,
    // allow rerun without forcing.
    const shouldBlock =
      alreadyCompleted &&
      !force &&
      (registryCount > 0 || transactionsCount > 0);

    if (shouldBlock) {
      return Response.json(
        {
          error:
            "Historical backfill is marked as completed. Pass { force: true } if you really want to run it again.",
        },
        { status: 409 },
      );
    }

    // Fail closed if we can't resolve required intents.
    // This prevents marking the backfill completed when nothing can post.
    const intentCheck = await validateRequiredIntents();
    if (!intentCheck.ok) {
      return Response.json(
        {
          error:
            "Cannot run backfill because required accounts are not resolvable. Seed the Chart of Accounts and/or set integration bindings, then rerun.",
          missingIntents: intentCheck.missing,
          intentResolution: intentCheck.results,
        },
        { status: 400 },
      );
    }

    const model = await discoverAccountingModel();
    if (!model.ok) {
      return Response.json(
        { error: model.error || "Could not discover accounting model" },
        { status: 500 },
      );
    }

    const stats = {
      rentAccrual: { inserted: 0, updated: 0, voided: 0, skipped: 0 },
      payments: {
        scanned: 0,
        posted: 0,
        skipped: 0,
        linkedExisting: 0,
        errors: 0,
      },
      payouts: {
        scanned: 0,
        posted: 0,
        skipped: 0,
        linkedExisting: 0,
        errors: 0,
      },
      landlordDeductions: {
        scanned: 0,
        posted: 0,
        skipped: 0,
        linkedExisting: 0,
        errors: 0,
      },
      tenantDeductions: {
        scanned: 0,
        posted: 0,
        skipped: 0,
        linkedExisting: 0,
        errors: 0,
      },
    };

    const errors = [];

    // 1) Property-level rent accrual + management fee (already idempotent by ref)
    if (!dryRun) {
      const accrual = await ensurePropertyAccrualLedgerViaCIL({});
      if (accrual?.ok) {
        stats.rentAccrual.inserted = Number(accrual.insertedCount || 0);
        stats.rentAccrual.updated = Number(accrual.updatedCount || 0);
        stats.rentAccrual.voided = Number(accrual.voidedCount || 0);
        stats.rentAccrual.skipped = accrual.skipped ? 1 : 0;
      } else {
        errors.push({
          scope: "rentAccrual",
          error: accrual?.error || "Failed",
        });
      }
    } else {
      stats.rentAccrual.skipped = 1;
    }

    // Helper to apply date range filters
    const dateWhere = [];
    const dateValues = [];
    if (from) {
      dateWhere.push(`d >= $${dateValues.length + 1}::date`);
      dateValues.push(from);
    }
    if (to) {
      dateWhere.push(`d <= $${dateValues.length + 1}::date`);
      dateValues.push(to);
    }

    // 2) Tenant payments -> Dr undeposited, Cr tenant receivable
    if (includePayments) {
      const where = ["p.is_reversed = false"]; // keep existing system meaning
      const values = [];

      if (from) {
        where.push(`p.payment_date >= $${values.length + 1}::date`);
        values.push(from);
      }
      if (to) {
        where.push(`p.payment_date <= $${values.length + 1}::date`);
        values.push(to);
      }

      const rows = await sql(
        `
          SELECT
            p.id,
            p.payment_date,
            p.amount,
            COALESCE(p.currency,'UGX')::text AS currency,
            p.property_id,
            p.tenant_id,
            p.reference_number,
            p.recorded_by,
            t.full_name AS tenant_name,
            pr.landlord_id
          FROM payments p
          LEFT JOIN tenants t ON t.id = p.tenant_id
          LEFT JOIN properties pr ON pr.id = p.property_id
          WHERE ${where.join(" AND ")}
          ORDER BY p.payment_date ASC, p.id ASC
        `,
        values,
      );

      for (const r of rows || []) {
        stats.payments.scanned += 1;

        const paymentId = String(r.id);
        const registry = await getRegistryRow("payment", paymentId);
        if (registry) {
          stats.payments.skipped += 1;
          continue;
        }

        const existing = await findExistingTxBySource({
          model,
          sourceType: "payment",
          sourceId: r.id,
        });

        const hash = await sha256(
          JSON.stringify({
            kind: "payment",
            id: r.id,
            date: r.payment_date,
            amount: r.amount,
            propertyId: r.property_id,
            tenantId: r.tenant_id,
          }),
        );

        if (existing) {
          stats.payments.linkedExisting += 1;
          if (!dryRun) {
            const txPk = model.transactions.pk || "id";
            await insertRegistryRow({
              sourceType: "payment",
              sourceEventId: paymentId,
              accountingTxId: existing?.[txPk] ?? null,
              hash,
            });
          }
          continue;
        }

        if (dryRun) {
          stats.payments.posted += 1;
          continue;
        }

        const ref = `PAYMENT:${paymentId}`;
        const desc = `Rent collection - ${r.tenant_name || "Tenant"}`;

        const post = await postAccountingEntryFromIntents({
          transactionDate: normalizeDateOnly(r.payment_date),
          description: desc,
          referenceNumber: ref,
          debitIntent: "undeposited_funds",
          creditIntent: "tenant_receivable",
          amount: Number(r.amount),
          currency: r.currency || "UGX",
          createdBy: r.recorded_by || perm.staff.id,
          landlordId: r.landlord_id || null,
          propertyId: r.property_id,
          sourceType: "payment",
          sourceId: r.id,
          auditContext: {
            source: "historical_backfill",
            businessEvent: "TENANT_PAYMENT_RECEIVED",
            sourceEntity: { type: "payment", id: r.id },
          },
        });

        if (!post.ok) {
          stats.payments.errors += 1;
          errors.push({ scope: "payments", id: r.id, error: post.error });
          continue;
        }

        stats.payments.posted += 1;

        await insertRegistryRow({
          sourceType: "payment",
          sourceEventId: paymentId,
          accountingTxId: post.transaction?.id ?? null,
          hash,
        });
      }
    }

    // 3) Landlord payouts -> Dr landlord liability, Cr cash/bank
    if (includePayouts) {
      const where = ["COALESCE(lp.is_deleted,false) = false"]; // keep existing system meaning
      const values = [];

      if (from) {
        where.push(`lp.payout_date >= $${values.length + 1}::date`);
        values.push(from);
      }
      if (to) {
        where.push(`lp.payout_date <= $${values.length + 1}::date`);
        values.push(to);
      }

      const rows = await sql(
        `
          SELECT
            lp.id,
            lp.landlord_id,
            lp.property_id,
            lp.payout_date,
            lp.amount,
            lp.payment_method,
            lp.reference_number,
            lp.created_by
          FROM landlord_payouts lp
          WHERE ${where.join(" AND ")}
          ORDER BY lp.payout_date ASC, lp.id ASC
        `,
        values,
      );

      for (const r of rows || []) {
        stats.payouts.scanned += 1;

        const payoutId = String(r.id);
        const registry = await getRegistryRow("landlord_payout", payoutId);
        if (registry) {
          stats.payouts.skipped += 1;
          continue;
        }

        const existing = await findExistingTxBySource({
          model,
          sourceType: "landlord_payout",
          sourceId: r.id,
        });

        const hash = await sha256(
          JSON.stringify({
            kind: "landlord_payout",
            id: r.id,
            date: r.payout_date,
            amount: r.amount,
            landlordId: r.landlord_id,
            propertyId: r.property_id,
          }),
        );

        if (existing) {
          stats.payouts.linkedExisting += 1;
          if (!dryRun) {
            const txPk = model.transactions.pk || "id";
            await insertRegistryRow({
              sourceType: "landlord_payout",
              sourceEventId: payoutId,
              accountingTxId: existing?.[txPk] ?? null,
              hash,
            });
          }
          continue;
        }

        const method = String(r.payment_method || "").trim();
        const creditIntent =
          method === "Cash" ? "cash_account" : "bank_account";

        if (dryRun) {
          stats.payouts.posted += 1;
          continue;
        }

        const ref = `PAYOUT:${payoutId}`;
        const desc = `Landlord payout - ${method || "Bank"}`;

        const post = await postAccountingEntryFromIntents({
          transactionDate: normalizeDateOnly(r.payout_date),
          description: desc,
          referenceNumber: ref,
          debitIntent: "landlord_liability",
          creditIntent,
          amount: Number(r.amount),
          currency: "UGX",
          createdBy: r.created_by || perm.staff.id,
          landlordId: r.landlord_id,
          propertyId: r.property_id,
          sourceType: "landlord_payout",
          sourceId: r.id,
          auditContext: {
            source: "historical_backfill",
            businessEvent: "LANDLORD_PAID",
            sourceEntity: { type: "landlord_payout", id: r.id },
          },
        });

        if (!post.ok) {
          stats.payouts.errors += 1;
          errors.push({ scope: "payouts", id: r.id, error: post.error });
          continue;
        }

        stats.payouts.posted += 1;

        await insertRegistryRow({
          sourceType: "landlord_payout",
          sourceEventId: payoutId,
          accountingTxId: post.transaction?.id ?? null,
          hash,
        });
      }
    }

    // 4) Landlord deductions -> Dr landlord liability, Cr cash/bank (default bank)
    if (includeDeductions) {
      const where = ["COALESCE(ld.is_deleted,false) = false"]; // keep existing system meaning
      const values = [];

      if (from) {
        where.push(`ld.deduction_date >= $${values.length + 1}::date`);
        values.push(from);
      }
      if (to) {
        where.push(`ld.deduction_date <= $${values.length + 1}::date`);
        values.push(to);
      }

      const rows = await sql(
        `
          SELECT
            ld.id,
            ld.landlord_id,
            ld.property_id,
            ld.deduction_date,
            ld.description,
            ld.amount,
            ld.created_by
          FROM landlord_deductions ld
          WHERE ${where.join(" AND ")}
          ORDER BY ld.deduction_date ASC, ld.id ASC
        `,
        values,
      );

      for (const r of rows || []) {
        stats.landlordDeductions.scanned += 1;

        const dedId = String(r.id);
        const registry = await getRegistryRow("landlord_deduction", dedId);
        if (registry) {
          stats.landlordDeductions.skipped += 1;
          continue;
        }

        const existing = await findExistingTxBySource({
          model,
          sourceType: "landlord_deduction",
          sourceId: r.id,
        });

        const hash = await sha256(
          JSON.stringify({
            kind: "landlord_deduction",
            id: r.id,
            date: r.deduction_date,
            amount: r.amount,
            landlordId: r.landlord_id,
            propertyId: r.property_id,
          }),
        );

        if (existing) {
          stats.landlordDeductions.linkedExisting += 1;
          if (!dryRun) {
            const txPk = model.transactions.pk || "id";
            await insertRegistryRow({
              sourceType: "landlord_deduction",
              sourceEventId: dedId,
              accountingTxId: existing?.[txPk] ?? null,
              hash,
            });
          }
          continue;
        }

        if (dryRun) {
          stats.landlordDeductions.posted += 1;
          continue;
        }

        const ref = `LDED:${dedId}`;
        const desc = `Landlord deduction - ${String(r.description || "").trim() || "Expense"}`;

        const post = await postAccountingEntryFromIntents({
          transactionDate: normalizeDateOnly(r.deduction_date),
          description: desc,
          referenceNumber: ref,
          debitIntent: "landlord_liability",
          creditIntent: "bank_account",
          amount: Number(r.amount),
          currency: "UGX",
          createdBy: r.created_by || perm.staff.id,
          landlordId: r.landlord_id,
          propertyId: r.property_id,
          expenseScope: "landlord",
          sourceType: "landlord_deduction",
          sourceId: r.id,
          auditContext: {
            source: "historical_backfill",
            businessEvent: "LANDLORD_DEDUCTION",
            sourceEntity: { type: "landlord_deduction", id: r.id },
          },
        });

        if (!post.ok) {
          stats.landlordDeductions.errors += 1;
          errors.push({
            scope: "landlordDeductions",
            id: r.id,
            error: post.error,
          });
          continue;
        }

        stats.landlordDeductions.posted += 1;

        await insertRegistryRow({
          sourceType: "landlord_deduction",
          sourceEventId: dedId,
          accountingTxId: post.transaction?.id ?? null,
          hash,
        });
      }

      // 5) Tenant deductions -> Dr tenant receivable? (existing app logic uses tenant-deductions route)
      // We backfill them the same way the current system models them: tenant deduction reduces what the tenant owes and reduces cash/bank.
      // (This stays consistent with how the UI feature behaves; we are not redesigning accounting here.)
      const tdWhere = ["COALESCE(td.is_deleted,false) = false"]; // keep existing system meaning
      const tdValues = [];

      if (from) {
        tdWhere.push(`td.deduction_date >= $${tdValues.length + 1}::date`);
        tdValues.push(from);
      }
      if (to) {
        tdWhere.push(`td.deduction_date <= $${tdValues.length + 1}::date`);
        tdValues.push(to);
      }

      const tdRows = await sql(
        `
          SELECT
            td.id,
            td.tenant_id,
            td.property_id,
            td.deduction_date,
            td.description,
            td.amount,
            td.created_by
          FROM tenant_deductions td
          WHERE ${tdWhere.join(" AND ")}
          ORDER BY td.deduction_date ASC, td.id ASC
        `,
        tdValues,
      );

      for (const r of tdRows || []) {
        stats.tenantDeductions.scanned += 1;

        const dedId = String(r.id);
        const registry = await getRegistryRow("tenant_deduction", dedId);
        if (registry) {
          stats.tenantDeductions.skipped += 1;
          continue;
        }

        const existing = await findExistingTxBySource({
          model,
          sourceType: "tenant_deduction",
          sourceId: r.id,
        });

        const hash = await sha256(
          JSON.stringify({
            kind: "tenant_deduction",
            id: r.id,
            date: r.deduction_date,
            amount: r.amount,
            tenantId: r.tenant_id,
            propertyId: r.property_id,
          }),
        );

        if (existing) {
          stats.tenantDeductions.linkedExisting += 1;
          if (!dryRun) {
            const txPk = model.transactions.pk || "id";
            await insertRegistryRow({
              sourceType: "tenant_deduction",
              sourceEventId: dedId,
              accountingTxId: existing?.[txPk] ?? null,
              hash,
            });
          }
          continue;
        }

        if (dryRun) {
          stats.tenantDeductions.posted += 1;
          continue;
        }

        const ref = `TDED:${dedId}`;
        const desc = `Tenant deduction - ${String(r.description || "").trim() || "Deduction"}`;

        const post = await postAccountingEntryFromIntents({
          transactionDate: normalizeDateOnly(r.deduction_date),
          description: desc,
          referenceNumber: ref,
          debitIntent: "tenant_receivable",
          creditIntent: "bank_account",
          amount: Number(r.amount),
          currency: "UGX",
          createdBy: r.created_by || perm.staff.id,
          landlordId: null,
          propertyId: r.property_id,
          expenseScope: "tenant",
          sourceType: "tenant_deduction",
          sourceId: r.id,
          auditContext: {
            source: "historical_backfill",
            businessEvent: "TENANT_DEDUCTION",
            sourceEntity: { type: "tenant_deduction", id: r.id },
          },
        });

        if (!post.ok) {
          stats.tenantDeductions.errors += 1;
          errors.push({
            scope: "tenantDeductions",
            id: r.id,
            error: post.error,
          });
          continue;
        }

        stats.tenantDeductions.posted += 1;

        await insertRegistryRow({
          sourceType: "tenant_deduction",
          sourceEventId: dedId,
          accountingTxId: post.transaction?.id ?? null,
          hash,
        });
      }
    }

    if (!dryRun && errors.length === 0) {
      await setBackfillStatusFlag(true);
    }

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "historical_backfill.run",
      entityType: "historical_backfill",
      entityId: null,
      oldValues: null,
      newValues: {
        dryRun,
        from,
        to,
        includePayments,
        includePayouts,
        includeDeductions,
        stats,
        errorsCount: errors.length,
      },
      ipAddress: perm.ipAddress,
    });

    return Response.json({
      ok: true,
      dryRun,
      from,
      to,
      stats,
      errors,
      markedCompleted: !dryRun && errors.length === 0,
    });
  } catch (error) {
    console.error("POST /api/accounting/backfill/historical error", error);
    const detail = String(error?.message || error || "");
    return Response.json(
      {
        error: "Failed to run historical backfill",
        detail: detail || null,
      },
      { status: 500 },
    );
  }
}
