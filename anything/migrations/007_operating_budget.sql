CREATE TABLE IF NOT EXISTS operating_budget_lines (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  period_month  DATE NOT NULL,
  amount        BIGINT NOT NULL CHECK (amount >= 0),
  created_by    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT operating_budget_lines_first_of_month CHECK (EXTRACT(DAY FROM period_month) = 1),
  CONSTRAINT operating_budget_lines_account_month_uniq UNIQUE (account_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_operating_budget_lines_period
  ON operating_budget_lines (period_month);
