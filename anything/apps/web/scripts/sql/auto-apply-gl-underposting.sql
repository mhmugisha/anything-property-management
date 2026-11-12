-- Auto-apply GL under-posting (pre fix/payment-locks).
--
-- Before this fix, re-applying the same payment/invoice pair ADDED to
-- payment_invoice_allocations.amount_applied, but the 'payment_auto_apply' GL
-- row (keyed by source_id = allocation id) was OVERWRITTEN with only the latest
-- increment. New code sets that GL row to the allocation's full total; rows
-- written before the fix are not touched until the pair is applied again.
--
-- Run step 1 (read-only) first. Run step 2 only after reviewing step 1.
-- Not run by Claude — for Mark, against the intended database.

-- 1. DIAGNOSTIC (read-only): live auto-apply GL rows whose amount differs from
--    their allocation's amount_applied.
SELECT
  pia.id                 AS allocation_id,
  pia.payment_id,
  pia.invoice_id,
  pia.amount_applied     AS allocation_total,
  t.id                   AS gl_id,
  t.amount               AS gl_amount,
  pia.amount_applied - t.amount AS under_posted
FROM payment_invoice_allocations pia
JOIN LATERAL (
  SELECT t.id, t.amount
  FROM transactions t
  WHERE t.source_type = 'payment_auto_apply'
    AND t.source_id = pia.id
    AND COALESCE(t.is_deleted, false) = false
  ORDER BY t.id
  LIMIT 1
) t ON true
WHERE t.amount <> pia.amount_applied
ORDER BY pia.id;

-- Allocations with more than one live auto-apply GL row (should be none;
-- review by hand if any appear, step 2 does not touch them):
SELECT source_id AS allocation_id, COUNT(*) AS live_rows, SUM(amount) AS total
FROM transactions
WHERE source_type = 'payment_auto_apply'
  AND COALESCE(is_deleted, false) = false
GROUP BY source_id
HAVING COUNT(*) > 1;

-- 2. FIX (writes): set each single live auto-apply GL row to its allocation
--    total. Wrap in a transaction and compare the row count with step 1.
--
-- BEGIN;
-- UPDATE transactions t
-- SET amount = pia.amount_applied
-- FROM payment_invoice_allocations pia
-- WHERE t.source_type = 'payment_auto_apply'
--   AND t.source_id = pia.id
--   AND COALESCE(t.is_deleted, false) = false
--   AND t.amount <> pia.amount_applied
--   AND pia.amount_applied > 0
--   AND (
--     SELECT COUNT(*) FROM transactions t2
--     WHERE t2.source_type = 'payment_auto_apply'
--       AND t2.source_id = pia.id
--       AND COALESCE(t2.is_deleted, false) = false
--   ) = 1
-- RETURNING t.id, t.source_id, t.amount;
-- COMMIT;   -- or ROLLBACK;
