import { resolveAccountIntent } from "@/app/api/utils/cil/bindings";
import { ensurePropertyAccrualLedgerViaCIL } from "@/app/api/utils/cil/propertyAccrualSync";
import {
  getLastEnsureInvoiceLedgerAtMs,
  setLastEnsureInvoiceLedgerAtMs,
  getEnsureInvoiceLedgerIntervalMs,
} from "./throttling";

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
