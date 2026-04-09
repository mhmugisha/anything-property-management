# Database Performance Indexes

This document lists the recommended database indexes to improve query performance. These indexes are critical for the dashboard and other high-traffic endpoints.

## Recommended Indexes

### 1. Transactions Table
These indexes speed up P&L queries, balance calculations, and account statement generation:

```sql
-- Speed up income/expense series queries (used in dashboard P&L chart)
CREATE INDEX IF NOT EXISTS idx_transactions_date_credit_account 
  ON transactions(transaction_date, credit_account_id) 
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_transactions_date_debit_account 
  ON transactions(transaction_date, debit_account_id) 
  WHERE COALESCE(is_deleted, false) = false;

-- Speed up account balance queries
CREATE INDEX IF NOT EXISTS idx_transactions_debit_not_deleted 
  ON transactions(debit_account_id, amount) 
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_transactions_credit_not_deleted 
  ON transactions(credit_account_id, amount) 
  WHERE COALESCE(is_deleted, false) = false;
```

### 2. Invoices Table
These indexes speed up dashboard stats queries and invoice lookups:

```sql
-- Speed up current month invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_year_month_status 
  ON invoices(invoice_year, invoice_month, status) 
  WHERE COALESCE(is_deleted, false) = false;

-- Speed up open/outstanding invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_status_amounts 
  ON invoices(status, amount, paid_amount) 
  WHERE COALESCE(is_deleted, false) = false;

-- Speed up arrears calculation
CREATE INDEX IF NOT EXISTS idx_invoices_date_amounts 
  ON invoices(invoice_year, invoice_month, amount, paid_amount) 
  WHERE COALESCE(is_deleted, false) = false AND status != 'void';
```

### 3. Payments Table
These indexes speed up payment allocation and collection queries:

```sql
-- Speed up tenant payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date 
  ON payments(tenant_id, payment_date) 
  WHERE is_reversed = false;

-- Speed up payment allocation queries
CREATE INDEX IF NOT EXISTS idx_payments_not_reversed 
  ON payments(id, amount, tenant_id) 
  WHERE is_reversed = false;
```

### 4. Payment Invoice Allocations Table
Speed up allocation lookups:

```sql
-- Already has unique index on (payment_id, invoice_id)
-- Add covering index for amount queries
CREATE INDEX IF NOT EXISTS idx_pia_invoice_amount 
  ON payment_invoice_allocations(invoice_id, amount_applied);

CREATE INDEX IF NOT EXISTS idx_pia_payment_amount 
  ON payment_invoice_allocations(payment_id, amount_applied);
```

### 5. Leases Table
Speed up portfolio and active lease queries:

```sql
-- Speed up active lease queries
CREATE INDEX IF NOT EXISTS idx_leases_status_rent 
  ON leases(status, monthly_rent) 
  WHERE status = 'active';
```

### 6. Chart of Accounts Table
Speed up account type filtering:

```sql
-- Speed up income/expense account lookups
CREATE INDEX IF NOT EXISTS idx_coa_account_type 
  ON chart_of_accounts(account_type, id) 
  WHERE is_active = true;
```

## How to Apply These Indexes

Run these SQL commands against your database. The `CREATE INDEX IF NOT EXISTS` ensures they won't fail if the index already exists.

You can run all indexes at once or apply them one section at a time to monitor impact.

## Expected Performance Impact

- **Dashboard stats endpoint**: 2-10x faster (from 5-15s → 0.5-2s)
- **P&L report**: 3-5x faster
- **Balance sheet**: 2-4x faster
- **Payment allocation**: 2-3x faster
- **Invoice queries**: 2-4x faster

## Monitoring

After applying indexes, monitor:
1. Dashboard load time
2. Database query execution time (via logs)
3. Database CPU usage (should decrease)
4. Response times for /api/dashboard/stats

## Notes

- These indexes are **partial indexes** (with WHERE clauses) to keep them small and fast
- They target the most common query patterns in the application
- Most indexes include the `is_deleted = false` filter since soft-deleted records are excluded from all calculations
