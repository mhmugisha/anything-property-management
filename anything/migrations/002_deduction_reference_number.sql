-- Migration: deduction reference_number
-- Run this in Neon before deploying the reference-number enforcement branch.
--
-- Adds an optional reference/voucher number to tenant and landlord deductions.
-- The accounting forms warn (but allow) when this is left blank, so the column
-- is nullable and additive — no backfill required.

ALTER TABLE tenant_deductions
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

ALTER TABLE landlord_deductions
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);
