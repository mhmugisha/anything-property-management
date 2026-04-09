import sql from "@/app/api/utils/sql";
import { isFeatureEnabled } from "./featureFlags";
import {
  postAccountingEntryFromIntents,
  softDeleteBySourceAndRefs,
} from "./postingAdapter";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function pad2(n) {
  const s = String(n);
  return s.length === 1 ? `0${s}` : s;
}

function makeRentRef({ propertyId, year, month, currency }) {
  return `RENT-ACCRUAL:${propertyId}:${year}-${pad2(month)}:${currency}`;
}

function makeFeeRef({ propertyId, year, month, currency }) {
  return `MGMTFEE:${propertyId}:${year}-${pad2(month)}:${currency}`;
}

export async function ensurePropertyAccrualLedgerViaCIL(options = {}) {
  const enabled = await isFeatureEnabled("cil_enabled");
  if (!enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "CIL disabled",
      insertedCount: 0,
      updatedCount: 0,
      voidedCount: 0,
    };
  }

  const leaseIdRaw =
    options?.leaseId !== undefined && options?.leaseId !== null
      ? Number(options.leaseId)
      : null;
  const leaseId =
    Number.isFinite(leaseIdRaw) && leaseIdRaw > 0 ? leaseIdRaw : null;

  // Discover which property-months are affected by this lease (so we can delete stale rows safely)
  const affected = leaseId
    ? await sql(
        `
          SELECT DISTINCT
            i.property_id,
            i.invoice_year,
            i.invoice_month,
            COALESCE(i.currency,'UGX')::text AS currency
          FROM invoices i
          WHERE i.lease_id = $1
            AND i.status <> 'void'
            AND COALESCE(i.is_deleted, false) = false
        `,
        [leaseId],
      )
    : [];

  const affectedRefs = {
    rent: new Set(),
    fee: new Set(),
  };

  for (const a of affected || []) {
    const propertyId = toNumber(a.property_id);
    const year = toNumber(a.invoice_year);
    const month = toNumber(a.invoice_month);
    const currency = String(a.currency || "UGX").trim() || "UGX";

    if (!propertyId || !year || !month) continue;
    affectedRefs.rent.add(makeRentRef({ propertyId, year, month, currency }));
    affectedRefs.fee.add(makeFeeRef({ propertyId, year, month, currency }));
  }

  // Build required monthly property summaries
  const where = ["i.status <> 'void'", "COALESCE(i.is_deleted, false) = false"];
  const values = [];

  if (leaseId) {
    where.push(
      `i.property_id IN (SELECT DISTINCT property_id FROM invoices WHERE lease_id = $1 AND status <> 'void' AND COALESCE(is_deleted, false) = false)`,
    );
    values.push(leaseId);
  }

  const required = await sql(
    `
      SELECT
        i.property_id,
        i.invoice_year,
        i.invoice_month,
        COALESCE(i.currency,'UGX')::text AS currency,
        date_trunc('month', MIN(i.invoice_date))::date AS txn_date,
        to_char(date_trunc('month', MIN(i.invoice_date))::date, 'FMMonth YYYY') AS month_label,
        SUM(i.amount)::numeric(15,2) AS gross_rent,
        COALESCE(MAX(p.landlord_id), NULL)::int AS landlord_id,
        COALESCE(MAX(p.property_name), 'Property')::text AS property_name,
        COALESCE(MAX(p.management_fee_type), 'percent')::text AS fee_type,
        COALESCE(MAX(p.management_fee_percent), 0)::numeric(5,2) AS fee_percent,
        COALESCE(MAX(p.management_fee_fixed_amount), 0)::numeric(15,2) AS fee_fixed,
        CASE
          WHEN COALESCE(MAX(p.management_fee_type), 'percent') = 'percent' THEN
            ROUND((SUM(i.amount) * COALESCE(MAX(p.management_fee_percent),0) / 100.0)::numeric, 2)
          WHEN COALESCE(MAX(p.management_fee_type), 'percent') = 'fixed' THEN
            CASE
              WHEN COALESCE(i.currency,'UGX') = 'UGX' THEN
                LEAST(
                  COALESCE(MAX(p.management_fee_fixed_amount),0)::numeric(15,2),
                  SUM(i.amount)::numeric(15,2)
                )
              ELSE 0
            END
          ELSE 0
        END::numeric(15,2) AS fee_amount
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      WHERE ${where.join(" AND ")}
      GROUP BY i.property_id, i.invoice_year, i.invoice_month, COALESCE(i.currency,'UGX')
      HAVING SUM(i.amount) > 0
      ORDER BY i.property_id, i.invoice_year, i.invoice_month
    `,
    values,
  );

  const keepRentRefs = [];
  const keepFeeRefs = [];

  let insertedCount = 0;
  let updatedCount = 0;

  for (const r of required || []) {
    const propertyId = toNumber(r.property_id);
    const landlordId = toNumber(r.landlord_id);
    const year = toNumber(r.invoice_year);
    const month = toNumber(r.invoice_month);
    const currency = String(r.currency || "UGX").trim() || "UGX";

    const txnDate = r.txn_date;
    const monthLabel = String(r.month_label || "").trim() || null;
    const propertyName = String(r.property_name || "Property");

    const grossRent = Number(r.gross_rent || 0);
    const feeAmount = Number(r.fee_amount || 0);

    if (!propertyId || !year || !month || !txnDate) continue;

    // Validation rules
    if (grossRent <= 0) continue;
    if (feeAmount < 0) continue;
    if (feeAmount > grossRent) {
      // Fail closed: don't post anything if the fee would exceed total rent.
      console.error("CIL fee validation failed", {
        propertyId,
        year,
        month,
        grossRent,
        feeAmount,
      });
      continue;
    }

    const rentRef = makeRentRef({ propertyId, year, month, currency });
    keepRentRefs.push(rentRef);

    const rentDesc = monthLabel
      ? `Rent billed (gross) - ${propertyName} - ${monthLabel}`
      : `Rent billed (gross) - ${propertyName}`;

    const rentPost = await postAccountingEntryFromIntents({
      transactionDate: txnDate,
      description: rentDesc,
      referenceNumber: rentRef,
      debitIntent: "tenant_receivable",
      creditIntent: "landlord_liability",
      amount: grossRent,
      currency,
      createdBy: null,
      landlordId,
      propertyId,
      sourceType: "rent_accrual_summary",
      sourceId: null,
      auditContext: {
        sourceModule: "property",
        businessEvent: "TENANT_INVOICED",
        aggregation: "property_month",
      },
    });

    if (rentPost.ok) {
      if (rentPost.posting === "insert") insertedCount += 1;
      else updatedCount += 1;
    } else {
      console.error("CIL rent accrual post failed", rentPost);
    }

    if (feeAmount > 0) {
      const feeRef = makeFeeRef({ propertyId, year, month, currency });
      keepFeeRefs.push(feeRef);

      const feeDesc = monthLabel
        ? `Management fee - ${propertyName} - ${monthLabel}`
        : `Management fee - ${propertyName}`;

      const feePost = await postAccountingEntryFromIntents({
        transactionDate: txnDate,
        description: feeDesc,
        referenceNumber: feeRef,
        debitIntent: "landlord_liability",
        creditIntent: "management_fee_income",
        amount: feeAmount,
        currency,
        createdBy: null,
        landlordId,
        propertyId,
        sourceType: "mgmt_fee_summary",
        sourceId: null,
        auditContext: {
          sourceModule: "property",
          businessEvent: "FEE_RECOGNIZED",
          aggregation: "property_month",
        },
      });

      if (feePost.ok) {
        if (feePost.posting === "insert") insertedCount += 1;
        else updatedCount += 1;
      } else {
        console.error("CIL fee post failed", feePost);
      }
    }
  }

  // Soft-delete stale summary rows
  const restrictRent = leaseId ? Array.from(affectedRefs.rent) : null;
  const restrictFee = leaseId ? Array.from(affectedRefs.fee) : null;

  const rentDel = await softDeleteBySourceAndRefs({
    sourceType: "rent_accrual_summary",
    keepReferences: keepRentRefs,
    restrictToReferences: restrictRent,
  });

  const feeDel = await softDeleteBySourceAndRefs({
    sourceType: "mgmt_fee_summary",
    keepReferences: keepFeeRefs,
    restrictToReferences: restrictFee,
  });

  const voidedCount =
    Number(rentDel?.deletedCount || 0) + Number(feeDel?.deletedCount || 0);

  return {
    ok: true,
    skipped: false,
    insertedCount,
    updatedCount,
    voidedCount,
  };
}
