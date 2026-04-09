import sql from "@/app/api/utils/sql";
import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { ensurePropertyAccrualLedgerViaCIL } from "@/app/api/utils/cil/propertyAccrualSync";
import {
  getLastEnsureInvoiceLedgerAtMs,
  setLastEnsureInvoiceLedgerAtMs,
  getEnsureInvoiceLedgerIntervalMs,
} from "./throttling";

async function migrateLegacyLedgerEntries({
  rentReceivableId,
  dueToLandlordsId,
  mgmtFeesId,
}) {
  // NEW: one-time / idempotent cleanup for legacy ledger entries.
  // Older versions posted rent collections as Dr Bank/Undeposited, Cr 2100 (Due to Landlords)
  // and posted commission as Dr 2100, Cr 4100.
  // With the accrual model, collections must credit 1210 (Rent Receivable), and commission
  // is recognized at invoice generation time.
  try {
    const cashRes = await resolveAccountIntent("cash_account");
    const bankRes = await resolveAccountIntent("bank_account");
    const undepRes = await resolveAccountIntent("undeposited_funds");

    const cashId = cashRes.ok ? Number(cashRes.accountId) : null;
    const bankId = bankRes.ok ? Number(bankRes.accountId) : null;
    const undepositedId = undepRes.ok ? Number(undepRes.accountId) : null;

    const assetDebitIds = [cashId, bankId, undepositedId].filter(Boolean);

    if (assetDebitIds.length > 0) {
      const migrateCollectionsSql = `
        WITH upd AS (
          UPDATE transactions t
          SET credit_account_id = $1::int
          WHERE COALESCE(t.is_deleted,false) = false
            AND t.credit_account_id = $2::int
            AND t.debit_account_id = ANY($3::int[])
            AND (t.source_type IS NULL OR t.source_type = 'payment')
            AND t.description ILIKE 'Rent collection%'
          RETURNING 1
        )
        SELECT COUNT(*)::int AS updated_count
        FROM upd
      `;

      const deleteLegacyCommissionSql = `
        WITH upd AS (
          UPDATE transactions t
          SET is_deleted = true,
              deleted_at = now(),
              deleted_by = NULL
          WHERE COALESCE(t.is_deleted,false) = false
            AND t.debit_account_id = $2::int
            AND t.credit_account_id = $3::int
            AND (t.source_type IS NULL OR t.source_type = 'payment')
            AND t.description ILIKE 'Commission%'
          RETURNING 1
        )
        SELECT COUNT(*)::int AS deleted_count
        FROM upd
      `;

      const [migrateRows, deleteRows] = await sql.transaction((txn) => [
        txn(migrateCollectionsSql, [
          rentReceivableId,
          dueToLandlordsId,
          assetDebitIds,
        ]),
        txn(deleteLegacyCommissionSql, [
          rentReceivableId,
          dueToLandlordsId,
          mgmtFeesId,
        ]),
      ]);

      const migratedCount = Number(migrateRows?.[0]?.updated_count || 0);
      const deletedLegacyCommCount = Number(
        deleteRows?.[0]?.deleted_count || 0,
      );

      if (migratedCount > 0 || deletedLegacyCommCount > 0) {
        console.log("Ledger migration applied", {
          migratedCount,
          deletedLegacyCommCount,
        });
      }
    }
  } catch (e) {
    console.error(
      "ensureInvoiceAccrualLedgerEntries: legacy ledger migration failed",
      e,
    );
  }
}

async function migrateFromPerInvoiceAccrualToMonthlySummary({
  rentReceivableId,
  dueToLandlordsId,
  mgmtFeesId,
}) {
  // Older versions posted per-invoice accrual rows (source_type='invoice') and also posted
  // fixed fees as separate rows (source_type='mgmt_fee_fixed').
  // We now post ONE rent accrual + ONE management fee per property-month.
  try {
    const rows = await sql.transaction((txn) => [
      txn(
        `
          WITH upd AS (
            UPDATE transactions t
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = NULL
            WHERE COALESCE(t.is_deleted,false) = false
              AND t.source_type = 'invoice'
              AND t.debit_account_id = $1::int
              AND t.credit_account_id = ANY($2::int[])
            RETURNING 1
          )
          SELECT COUNT(*)::int AS deleted_count
          FROM upd
        `,
        [rentReceivableId, [dueToLandlordsId, mgmtFeesId]],
      ),
      txn(
        `
          WITH upd AS (
            UPDATE transactions t
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = NULL
            WHERE COALESCE(t.is_deleted,false) = false
              AND t.source_type = 'mgmt_fee_fixed'
            RETURNING 1
          )
          SELECT COUNT(*)::int AS deleted_count
          FROM upd
        `,
        [],
      ),
    ]);

    const deletedInvoiceAccruals = Number(rows?.[0]?.[0]?.deleted_count || 0);
    const deletedFixedFees = Number(rows?.[1]?.[0]?.deleted_count || 0);

    if (deletedInvoiceAccruals > 0 || deletedFixedFees > 0) {
      console.log("Ledger migration (monthly summary) applied", {
        deletedInvoiceAccruals,
        deletedFixedFees,
      });
    }
  } catch (e) {
    console.error(
      "ensureInvoiceAccrualLedgerEntries: per-invoice->monthly migration failed",
      e,
    );
  }
}

export async function ensureInvoiceAccrualLedgerEntries(options = {}) {
  const now = Date.now();
  const force = options?.force === true;

  const leaseIdRaw =
    options?.leaseId !== undefined && options?.leaseId !== null
      ? Number(options.leaseId)
      : null;
  const leaseId =
    Number.isFinite(leaseIdRaw) && leaseIdRaw > 0 ? leaseIdRaw : null;

  if (
    !force &&
    now - getLastEnsureInvoiceLedgerAtMs() < getEnsureInvoiceLedgerIntervalMs()
  ) {
    return { insertedCount: 0, updatedCount: 0, voidedCount: 0 };
  }

  setLastEnsureInvoiceLedgerAtMs(now);

  // Resolve required accounts by semantic intent.
  const rentRecv = await resolveAccountIntent("tenant_receivable");
  const dueToL = await resolveAccountIntent("landlord_liability");
  const mgmtInc = await resolveAccountIntent("management_fee_income");

  const rentReceivableId = rentRecv.ok ? Number(rentRecv.accountId) : null;
  const dueToLandlordsId = dueToL.ok ? Number(dueToL.accountId) : null;
  const mgmtFeesId = mgmtInc.ok ? Number(mgmtInc.accountId) : null;

  if (!rentReceivableId || !dueToLandlordsId || !mgmtFeesId) {
    console.error(
      "ensureInvoiceAccrualLedgerEntries: missing accounting bindings (tenant_receivable, landlord_liability, management_fee_income)",
      { rentReceivableId, dueToLandlordsId, mgmtFeesId },
    );
    return { insertedCount: 0, updatedCount: 0, voidedCount: 0 };
  }

  await migrateLegacyLedgerEntries({
    rentReceivableId,
    dueToLandlordsId,
    mgmtFeesId,
  });

  // One-time cleanup of prior ledger styles.
  await migrateFromPerInvoiceAccrualToMonthlySummary({
    rentReceivableId,
    dueToLandlordsId,
    mgmtFeesId,
  });

  const result = await ensurePropertyAccrualLedgerViaCIL({
    force,
    leaseId,
  });

  if (!result?.ok) {
    console.error("ensurePropertyAccrualLedgerViaCIL failed", result);
    return { insertedCount: 0, updatedCount: 0, voidedCount: 0 };
  }

  return {
    insertedCount: Number(result.insertedCount || 0),
    updatedCount: Number(result.updatedCount || 0),
    voidedCount: Number(result.voidedCount || 0),
  };
}
