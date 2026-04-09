import sql from "@/app/api/utils/sql";

export async function ensureFixedManagementFeeLedgerEntries({
  dueToLandlordsId,
  mgmtFeesId,
}) {
  // Posts ONE fixed fee entry per property-month (only for properties configured as fixed).
  // Idempotent via unique index on transactions.reference_number for source_type='mgmt_fee_fixed'.
  const query = `
    WITH required AS (
      SELECT
        i.property_id,
        i.invoice_year,
        i.invoice_month,
        date_trunc('month', MIN(i.invoice_date))::date AS fee_date,
        SUM(i.amount)::numeric(15,2) AS total_rent,
        MAX(p.management_fee_fixed_amount)::numeric(15,2) AS fixed_amount,
        MAX(p.landlord_id)::int AS landlord_id,
        MAX(p.property_name)::text AS property_name,
        LEAST(
          MAX(p.management_fee_fixed_amount)::numeric(15,2),
          SUM(i.amount)::numeric(15,2)
        )::numeric(15,2) AS fee_amount,
        (
          'MGMTFEE-FIXED:' || i.property_id::text || ':' || i.invoice_year::text || '-' || LPAD(i.invoice_month::text, 2, '0')
        ) AS ref,
        (
          'Management fee (fixed) - ' || MAX(p.property_name) || ' - ' || to_char(date_trunc('month', MIN(i.invoice_date))::date, 'FMMonth YYYY')
        ) AS descr
      FROM invoices i
      JOIN properties p ON p.id = i.property_id
      WHERE p.management_fee_type = 'fixed'
        AND i.status <> 'void'
      GROUP BY i.property_id, i.invoice_year, i.invoice_month
      HAVING SUM(i.amount) > 0
         AND COALESCE(MAX(p.management_fee_fixed_amount), 0) > 0
    ),
    soft_delete AS (
      UPDATE transactions t
      SET is_deleted = true,
          deleted_at = now(),
          deleted_by = NULL
      WHERE t.source_type = 'mgmt_fee_fixed'
        AND COALESCE(t.is_deleted,false) = false
        AND NOT EXISTS (
          SELECT 1
          FROM required r
          WHERE r.ref = t.reference_number
        )
      RETURNING 1
    ),
    upsert AS (
      INSERT INTO transactions (
        transaction_date, description, reference_number,
        debit_account_id, credit_account_id,
        amount, currency,
        created_by,
        landlord_id, property_id,
        source_type, source_id
      )
      SELECT
        r.fee_date,
        r.descr,
        r.ref,
        $1::int,
        $2::int,
        r.fee_amount,
        'UGX',
        NULL,
        r.landlord_id,
        r.property_id,
        'mgmt_fee_fixed',
        NULL
      FROM required r
      WHERE r.fee_amount > 0
      ON CONFLICT (reference_number) DO UPDATE
      SET transaction_date = EXCLUDED.transaction_date,
          description = EXCLUDED.description,
          debit_account_id = EXCLUDED.debit_account_id,
          credit_account_id = EXCLUDED.credit_account_id,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          landlord_id = EXCLUDED.landlord_id,
          property_id = EXCLUDED.property_id,
          is_deleted = false,
          deleted_at = NULL,
          deleted_by = NULL
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM upsert) AS upserted_count,
      (SELECT COUNT(*)::int FROM soft_delete) AS deleted_count
  `;

  const rows = await sql(query, [dueToLandlordsId, mgmtFeesId]);
  return {
    upsertedCount: Number(rows?.[0]?.upserted_count || 0),
    deletedCount: Number(rows?.[0]?.deleted_count || 0),
  };
}
