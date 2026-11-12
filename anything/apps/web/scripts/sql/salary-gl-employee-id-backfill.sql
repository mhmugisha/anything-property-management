-- Salary payment GL rows (source_type = 'payroll_payment', Dr 2300) written
-- before fix/payment-locks have transactions.employee_id NULL; the employee
-- is only in the description ("Salary payment — employee #N"). New payouts set
-- employee_id directly.
--
-- Run steps 0 and 1 (read-only) first. Step 2 is commented out.
-- Not run by Claude — for Mark, against the intended database.

-- 0. Sanity check: the column must exist (new payout code writes it).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'employee_id';

-- 1. DIAGNOSTIC (read-only): salary GL rows missing employee_id, with the id
--    parsed from the description and cross-checked against the payroll entry
--    the row points at (source_id = payroll_entries.id).
SELECT
  t.id                                   AS transaction_id,
  t.transaction_date,
  t.reference_number,
  t.amount,
  t.description,
  substring(t.description FROM '#([0-9]+)')::int AS employee_id_from_description,
  pe.employee_id                         AS employee_id_from_entry,
  CASE
    WHEN pe.id IS NULL THEN 'no matching payroll entry'
    WHEN substring(t.description FROM '#([0-9]+)') IS NULL THEN 'no #N in description'
    WHEN substring(t.description FROM '#([0-9]+)')::int <> pe.employee_id THEN 'MISMATCH'
    ELSE 'ok'
  END                                    AS check_result,
  COALESCE(t.is_deleted, false)          AS is_deleted
FROM transactions t
LEFT JOIN payroll_entries pe ON pe.id = t.source_id
WHERE t.source_type = 'payroll_payment'
  AND t.employee_id IS NULL
ORDER BY t.id;

-- 2. BACKFILL (writes): only rows where the description and the payroll entry
--    agree. Review any 'MISMATCH' / 'no matching payroll entry' rows by hand.
--
-- BEGIN;
-- UPDATE transactions t
-- SET employee_id = pe.employee_id
-- FROM payroll_entries pe
-- WHERE t.source_type = 'payroll_payment'
--   AND t.employee_id IS NULL
--   AND pe.id = t.source_id
--   AND substring(t.description FROM '#([0-9]+)')::int = pe.employee_id
-- RETURNING t.id, t.employee_id;
-- COMMIT;   -- or ROLLBACK;
