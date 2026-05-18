-- Migration: lease_review_flags
-- Run this in Neon before deploying the feature/lease-review-flags branch.
--
-- Creates the table that replaces silent lease auto-ending with a flag-based
-- review system. The enforcement function raises rows here; humans resolve them.

CREATE TABLE IF NOT EXISTS lease_review_flags (
  id              SERIAL PRIMARY KEY,
  lease_id        INTEGER      NOT NULL REFERENCES leases(id),
  reason          TEXT         NOT NULL,  -- 'end_date_passed' | 'landlord_ended' | 'landlord_contract_expired'
  reason_detail   TEXT,                   -- human-readable explanation
  raised_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,            -- NULL while unresolved
  resolved_by     INTEGER      REFERENCES staff_users(id),
  resolution_note TEXT
);

-- Fast "all unresolved flags for a given lease" lookups
CREATE INDEX IF NOT EXISTS idx_lease_review_flags_lease_resolved
  ON lease_review_flags (lease_id, resolved_at);

-- Fast "all unresolved flags across the system" queries
CREATE INDEX IF NOT EXISTS idx_lease_review_flags_resolved_at
  ON lease_review_flags (resolved_at);

-- Prevents raising a duplicate unresolved flag for the same lease+reason.
-- The enforcement function uses: ON CONFLICT (lease_id, reason) WHERE resolved_at IS NULL DO NOTHING
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_review_flags_unresolved_unique
  ON lease_review_flags (lease_id, reason)
  WHERE resolved_at IS NULL;
