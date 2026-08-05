-- Migration: allocated_by_transaction_id on transactions
-- Run this in Neon before deploying the allocate-payment branch.
--
-- Adds a nullable pointer column that mirrors deposited_by_transaction_id.
-- Set when a Holding (2500) journal entry has been cleared by a subsequent
-- Dr Holding / Cr Tenant Prepayments allocation transaction (payment_allocation
-- source_type). Nullable + additive — no backfill required.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS allocated_by_transaction_id INTEGER;
