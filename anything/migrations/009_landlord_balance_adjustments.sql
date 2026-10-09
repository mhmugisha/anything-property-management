CREATE TABLE IF NOT EXISTS landlord_balance_adjustments (
  id SERIAL PRIMARY KEY,
  landlord_id INTEGER NOT NULL REFERENCES landlords(id),
  property_id INTEGER NOT NULL REFERENCES properties(id),
  amount BIGINT NOT NULL,                 -- signed: + increases due, − decreases
  reason TEXT,
  source_type TEXT NOT NULL DEFAULT 'landlord_credit',
  source_id INTEGER,
  created_by INTEGER,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lba_landlord_property
  ON landlord_balance_adjustments(landlord_id, property_id);
