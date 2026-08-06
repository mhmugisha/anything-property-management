-- Migration: void support for employee_advances
-- Run this in Neon before deploying the feat/payroll-advance-void branch.
--
-- Adds three nullable/defaulted columns that mirror the transactions-table
-- soft-delete shape (is_deleted / deleted_at / deleted_by). A voided advance
-- is one whose GL entry has been reversed via POST /api/payroll/advances/[id]/void.
-- All deduction and termination queries must exclude is_voided = true so voided
-- advances stop being pulled into payroll math.
--
-- Additive: no backfill required (existing rows implicitly is_voided = false).

ALTER TABLE employee_advances
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by INTEGER;
