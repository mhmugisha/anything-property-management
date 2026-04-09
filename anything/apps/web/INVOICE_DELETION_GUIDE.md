# Invoice Deletion Implementation Guide

## Overview
This system now supports **safe invoice deletion** using soft-delete functionality. Deleted invoices are hidden from all reports and calculations, but the data is preserved for audit purposes.

---

## ✅ What Was Implemented

### 1. **Database Schema Updates**
Added three new columns to the `invoices` table:
- `is_deleted` (boolean) - Flags the invoice as deleted
- `deleted_at` (timestamp) - Records when the invoice was deleted
- `deleted_by` (integer) - References the staff user who deleted it

### 2. **DELETE API Endpoint**
**Path:** `/api/invoices/[id]`  
**Method:** `DELETE`  
**Permission:** `accounting`

**Safety Checks:**
- ✅ Cannot delete if invoice has payments applied (`paid_amount > 0`)
- ✅ Cannot delete if payment allocations exist
- ✅ Idempotent (safe to call multiple times)
- ✅ Auto-syncs accounting ledger after deletion
- ✅ Full audit trail logged

### 3. **Updated Queries**
All invoice queries now exclude deleted invoices using:
```sql
WHERE COALESCE(i.is_deleted, false) = false
```

**Updated Files:**
- `/apps/web/src/app/api/utils/cil/propertyAccrualSync.js` (Accounting)
- `/apps/web/src/app/api/utils/payments/autoApply.js` (Payment allocation)
- `/apps/web/src/app/api/reports/arrears/route.js`
- `/apps/web/src/app/api/reports/payment-status/route.js`
- `/apps/web/src/app/api/reports/tenant-statement/route.js`
- `/apps/web/src/app/api/reports/consolidated-balances-due/route.js`
- `/apps/web/src/app/api/payments/open-balances/route.js`
- `/apps/web/src/app/api/invoices/due/route.js`

### 4. **UI Components**
- **Hook:** `/apps/web/src/hooks/useDeleteInvoice.js`
- **Component:** `/apps/web/src/components/InvoiceDeleteButton.jsx`

---

## 🎯 How to Use

### From the UI
Add the delete button to any page that displays invoices:

```javascript
import InvoiceDeleteButton from "@/components/InvoiceDeleteButton";

// In your component:
<InvoiceDeleteButton
  invoiceId={invoice.id}
  onDeleted={(id) => {
    // Refresh your data here
    refetch();
  }}
  disabled={invoice.paid_amount > 0}
/>
```

### From the API
```javascript
const response = await fetch('/api/invoices/123', {
  method: 'DELETE'
});

const result = await response.json();

if (result.ok) {
  console.log('Invoice deleted successfully');
}
```

---

## 🛡️ Safety Features

### What You **CAN** Delete:
- ✅ Unpaid invoices (no payments applied)
- ✅ Invoices with no payment allocations
- ✅ Invoices created by mistake
- ✅ Duplicate invoices

### What You **CANNOT** Delete:
- ❌ Invoices with any `paid_amount > 0`
- ❌ Invoices with payment allocations in `payment_invoice_allocations`
- ❌ You must reverse payments first, then delete

---

## 🔄 What Happens When You Delete an Invoice

1. **Invoice is soft-deleted** (marked with `is_deleted = true`)
2. **Accounting automatically re-syncs** for that property-month
3. **Monthly summaries recalculate** without the deleted invoice
4. **All reports exclude** the deleted invoice
5. **Audit log is created** tracking who deleted it and when

---

## 📊 Impact on Accounting

Your system uses **monthly property-level accounting**, NOT per-invoice accounting. This makes deletion safe:

**Before Deletion:**
- Property A, January 2025: 3 invoices = UGX 600,000
- Accounting entry: Debit Receivable UGX 600,000

**After Deleting 1 Invoice:**
- Property A, January 2025: 2 invoices = UGX 400,000
- Accounting entry auto-updates: Debit Receivable UGX 400,000

The monthly summary automatically recalculates!

---

## 🔍 Audit Trail

Every deletion is logged in the `audit_logs` table with:
- Staff user ID who performed the deletion
- Full invoice data before deletion
- Timestamp of deletion
- IP address of the user

---

## 🚀 Example Scenarios

### Scenario 1: Wrong Lease Start Date
**Problem:** Created lease starting Jan 1st, should be Feb 1st  
**Solution:**
1. Delete all January invoices (they're unpaid)
2. Update lease start date to Feb 1st
3. Re-run invoice generation
4. Accounting auto-syncs correctly

### Scenario 2: Duplicate Invoice
**Problem:** Accidentally generated 2 invoices for same month  
**Solution:**
1. Identify the duplicate
2. Delete it (if unpaid)
3. System recalculates automatically

### Scenario 3: Invoice with Payment
**Problem:** Need to delete invoice but payment was applied  
**Solution:**
1. **First:** Reverse the payment at `/api/payments/[id]` (DELETE)
2. **Then:** Delete the invoice
3. Both will be soft-deleted with full audit trail

---

## 🔧 Technical Details

### Soft Delete Pattern
```sql
-- Mark as deleted (never actually DELETE)
UPDATE invoices
SET is_deleted = true,
    deleted_at = now(),
    deleted_by = [staff_id]
WHERE id = [invoice_id];
```

### Query Pattern
```sql
-- Always filter out deleted invoices
SELECT * FROM invoices
WHERE COALESCE(is_deleted, false) = false;
```

### Recovery (Manual)
If you need to undelete an invoice:
```sql
UPDATE invoices
SET is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL
WHERE id = [invoice_id];
```

---

## 📝 Best Practices

1. **Always check for payments first** before attempting deletion
2. **Use the UI component** for built-in safety checks and confirmations
3. **Review audit logs** regularly for deletion activity
4. **Test in reports** after deletion to ensure calculations are correct
5. **Document the reason** in your team's notes when deleting invoices

---

## 🎉 Summary

Invoice deletion is now:
- ✅ **Safe** (multiple validation checks)
- ✅ **Auditable** (full trail of who, when, what)
- ✅ **Reversible** (soft delete keeps data)
- ✅ **Automatic** (accounting recalculates)
- ✅ **Integrated** (works with all reports and queries)

You can now confidently delete invoices created in error without breaking your accounting!
