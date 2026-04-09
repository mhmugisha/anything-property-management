import sql from "@/app/api/utils/sql";
import {
  getLastNormalizeFixedInvoicesAtMs,
  setLastNormalizeFixedInvoicesAtMs,
  getNormalizeFixedInvoicesIntervalMs,
} from "./throttling";

export async function normalizeFixedFeeInvoices(options = {}) {
  const now = Date.now();
  const force = options?.force === true;

  if (
    !force &&
    now - getLastNormalizeFixedInvoicesAtMs() <
      getNormalizeFixedInvoicesIntervalMs()
  ) {
    return { updatedCount: 0 };
  }

  setLastNormalizeFixedInvoicesAtMs(now);

  // Management fees are no longer stored per invoice line (for BOTH percent and fixed).
  // Keep invoices clean so reports + ledger stay consistent.
  const rows = await sql(
    `
      WITH upd AS (
        UPDATE invoices i
        SET commission_rate = 0,
            commission_amount = 0
        WHERE i.status <> 'void'
          AND (
            COALESCE(i.commission_rate, 0) <> 0
            OR COALESCE(i.commission_amount, 0) <> 0
          )
        RETURNING 1
      )
      SELECT COUNT(*)::int AS updated_count
      FROM upd
    `,
    [],
  );

  return { updatedCount: Number(rows?.[0]?.updated_count || 0) };
}
