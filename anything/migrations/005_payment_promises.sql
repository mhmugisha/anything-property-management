-- Migration: payment_promises
-- Run this in Neon before deploying the feat/payment-promises branch.
--
-- Stores per-tenant "promise to pay" notes captured by staff when talking to
-- tenants about arrears. Each row is one call/note; the LATEST row per tenant
-- is the currently-standing promise. History is preserved (no UPDATE-in-place
-- of prior calls — new calls create new rows).

CREATE TABLE IF NOT EXISTS payment_promises (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER      NOT NULL REFERENCES tenants(id),
  promise_date  DATE         NOT NULL,
  amount        NUMERIC(14,2),                     -- optional promised amount
  comment       TEXT,                              -- what the tenant said; API enforces non-empty
  recorded_by   INTEGER      NOT NULL REFERENCES staff_users(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast "all promises for a tenant, newest first" lookups (history view)
-- and "latest per tenant" lookups (arrears report annotation).
CREATE INDEX IF NOT EXISTS idx_payment_promises_tenant_created
  ON payment_promises (tenant_id, created_at DESC);
