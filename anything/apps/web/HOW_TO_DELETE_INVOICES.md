# How to Delete Invoices - Complete Guide

## ✅ Implementation Complete

Your property management system now has **safe invoice deletion** functionality with automatic accounting synchronization.

---

## 📍 Where to Find the Delete Button

The delete button is now available on the **Open Balances** page at `/payments/open-balances`.

### Page Location
Navigate to: **Payments → Open Balances**

---

## 🔴 How to Delete an Invoice

### Step-by-Step Instructions

1. **Go to Open Balances Page**
   - Click "Payments" in the sidebar
   - Select "Open Balances"

2. **Find the Invoice**
   - Use filters to find the specific invoice:
     - Filter by property
     - Filter by status (overdue/current)
     - Filter by date range
   
3. **Look for the Delete Button**
   - If you have payment permissions, you'll see a red "Delete" button in the Actions column
   - ⚠️ **The button will be DISABLED if the invoice has any payments applied**

4. **Click Delete**
   - A confirmation dialog will appear asking you to confirm
   - Click "OK" to proceed or "Cancel" to abort

5. **Automatic Updates**
   - The invoice is marked as deleted (soft delete)
   - The page automatically refreshes to show updated data
   - Accounting is automatically recalculated

---

## 🛡️ Safety Rules - What You CAN and CANNOT Delete

### ✅ You CAN Delete:
- **Unpaid invoices** (no payments recorded against them)
- **Duplicate invoices** created by mistake
- **Invoices with wrong dates** or incorrect details
- **Test invoices** created during setup

### ❌ You CANNOT Delete:
- **Invoices with payments applied** (`paid_amount > 0`)
- **Invoices with payment allocations**

**If you try to delete an invoice with payments:**
- The delete button will be disabled (grayed out)
- If you force-delete via API, you'll get this error:
  ```
  "Cannot delete invoice with payments applied. Please reverse the payments first."
  ```

---

## 🔍 How Deleted Invoices Impact Reports

Deleted invoices are **automatically excluded** from ALL calculations and reports:

### Reports That Automatically Update:

1. **Open Balances Report** (`/payments/open-balances`)
   - Deleted invoices disappear immediately
   - Outstanding balances recalculate

2. **Arrears Report** (`/api/reports/arrears`)
   - Removed from overdue calculations
   - Tenant arrears totals update automatically

3. **Tenant Statement** (`/reports/tenant-statement`)
   - Invoices won't appear in the invoice list
   - Balance due recalculates without deleted invoices

4. **Landlord Statement** (`/api/reports/landlord-statement`)
   - Gross rent recalculates
   - Management fees recalculate
   - Net due to landlord updates

5. **Property Statement** (`/api/reports/property-statement`)
   - Invoices removed from property view
   - Property totals recalculate

6. **Accounting Ledger** (`/accounting`)
   - **Monthly summaries automatically recalculate**
   - Rent accrual entries update for the property-month
   - Management fee entries update

### Example Impact:

**Before Deletion:**
- Property A, January 2025: 3 invoices = UGX 600,000
- Accounting ledger shows UGX 600,000 rent receivable

**After Deleting 1 Invoice (UGX 200,000):**
- Property A, January 2025: 2 invoices = UGX 400,000
- Accounting ledger automatically updates to UGX 400,000 rent receivable
- All reports now show UGX 400,000

---

## 💡 Common Scenarios

### Scenario 1: Wrong Lease Date
**Problem:** Invoice generated for wrong lease period  
**Solution:**
1. Check if invoice has payments → If yes, reverse payments first
2. Delete the incorrect invoice
3. Generate new invoice with correct dates

### Scenario 2: Duplicate Invoice
**Problem:** Same invoice created twice for the same tenant  
**Solution:**
1. Identify which invoice is the duplicate
2. Ensure the duplicate has no payments
3. Delete the duplicate invoice

### Scenario 3: Test Data Cleanup
**Problem:** Test invoices from setup phase  
**Solution:**
1. Filter for test property or test tenant
2. Delete all unpaid test invoices
3. System recalculates everything automatically

### Scenario 4: Invoice Has Payments
**Problem:** Need to delete invoice but payments have been recorded  
**Solution:**
1. Go to Tenant Statement
2. Find and delete/reverse the payment first
3. Then delete the invoice

---

## 🔧 Technical Details

### What Happens Behind the Scenes

When you delete an invoice:

1. **Soft Delete** (not permanent)
   - Invoice marked as `is_deleted = true`
   - Timestamp recorded in `deleted_at`
   - Staff user recorded in `deleted_by`

2. **Accounting Sync**
   - System recalculates monthly rent accrual for that property-month
   - Management fee entries update automatically
   - New totals post to accounting ledger

3. **Audit Trail**
   - Deletion logged to `audit_logs` table
   - Who deleted it
   - When it was deleted
   - What the old values were

### Database Query Filters

All invoice queries now include:
```sql
WHERE COALESCE(i.is_deleted, false) = false
```

This means deleted invoices are excluded from:
- Balance calculations
- Payment allocation
- Report generation
- Accounting summaries
- Auto-payment matching

---

## 🚨 Troubleshooting

### "Delete button is disabled"
**Cause:** Invoice has payments applied  
**Fix:** Reverse/delete the payment first, then delete the invoice

### "Invoice deleted but still shows in report"
**Cause:** Browser cache  
**Fix:** Refresh the page (F5 or Ctrl+R)

### "Accounting totals don't match"
**Cause:** Accounting sync failed  
**Fix:** Run manual accounting backfill at `/accounting/backfill`

### "Can't find the delete button"
**Cause:** Missing payment permissions  
**Fix:** Ask admin to grant you "payments" permission

---

## 📊 Permissions Required

To delete invoices, you need:
- **Role:** Staff user with `accounting` permission
- **Permission Check:** `requirePermission(request, "accounting")`

If you don't have this permission, the delete button won't appear.

---

## ⚙️ API Reference

### Delete Invoice Endpoint

**Endpoint:** `DELETE /api/invoices/[id]`

**Example:**
```javascript
const res = await fetch('/api/invoices/123', {
  method: 'DELETE'
});

const data = await res.json();
// { ok: true, message: "Invoice deleted successfully" }
```

**Error Responses:**
```javascript
// Invoice has payments
{
  "error": "Cannot delete invoice with payments applied. Please reverse the payments first.",
  "paidAmount": 50000
}

// Invoice not found
{
  "error": "Invoice not found"
}

// Already deleted (idempotent)
{
  "ok": true,
  "message": "Invoice already deleted",
  "alreadyDeleted": true
}
```

---

## 🎯 Best Practices

1. **Always check for payments first** before attempting deletion
2. **Use filters** to find exact invoices instead of scrolling
3. **Double-check** the tenant/property before clicking delete
4. **Review reports** after deletion to confirm accounting is correct
5. **Document the reason** for deletion in your own records

---

## 📝 Summary

✅ **Safe deletion** - blocked if payments exist  
✅ **Auto-sync** - accounting recalculates automatically  
✅ **Audit trail** - who deleted what and when  
✅ **Report updates** - all reports exclude deleted invoices  
✅ **Reversible** - soft delete means data is preserved  

Your system is now production-ready for managing invoice corrections and cleanup! 🎉
