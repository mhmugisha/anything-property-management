-- Migration: chart_of_accounts.is_cash_bank
-- Run this in Neon BEFORE deploying the feat/bank-account-flag branch.
--
-- Adds a boolean tag to chart_of_accounts so cash/bank accounts (Cash on Hand
-- 1110, Bank Account - Operating 1120, and any future ones) can be filtered
-- for UI dropdowns (e.g. "Receive to Holding" debit account picker).
--
-- IMPORTANT: this does NOT touch account_type. Bank accounts stay
-- account_type = 'Asset' so the balance sheet, trial balance, P&L, and dashboard
-- rollups (which filter on account_type) continue to include them correctly.
-- This column is additive and invisible to those existing report queries.

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_cash_bank BOOLEAN NOT NULL DEFAULT false;

-- Backfill the current cash/bank accounts.
UPDATE chart_of_accounts
   SET is_cash_bank = true
 WHERE account_code IN ('1110', '1120');
