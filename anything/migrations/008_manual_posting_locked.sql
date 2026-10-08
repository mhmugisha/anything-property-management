ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS manual_posting_locked boolean NOT NULL DEFAULT false;

UPDATE chart_of_accounts
SET manual_posting_locked = true,
    account_name = 'Salaries & Wages'
WHERE account_code = '5160';
