# Professional Print/PDF System Guide

## Overview
This project uses a centralized print utility (`/apps/web/src/utils/printUtils.js`) that provides professional print/PDF functionality with:

✅ **Page X of Y** numbering
✅ Repeating headers on every page
✅ Clean table breaks (no row splitting)
✅ Proper margins and footer placement
✅ Dynamic cell heights with text wrapping
✅ Print-optimized CSS

## Implementation Status

### ✅ Completed
- `/apps/web/src/utils/printUtils.js` - Core utility created
- `/apps/web/src/components/Reports/PaymentStatusReport.jsx` - Updated
- `/apps/web/src/components/Reports/ConsolidatedBalancesDueReport.jsx` - Updated

### ⏳ Needs Update
The following files still need to be updated to use the new print utility:

1. `/apps/web/src/components/Reports/LandlordPayableBalancesReport.jsx`
2. `/apps/web/src/components/Reports/ArrearsReport.jsx`
3. `/apps/web/src/components/Reports/LandlordMonthlySummary.jsx`
4. `/apps/web/src/components/Reports/LandlordPayoutsSummary.jsx`
5. `/apps/web/src/components/Reports/LandlordStatementReport.jsx`
6. `/apps/web/src/components/Reports/PropertyStatementReport.jsx`
7. `/apps/web/src/components/Reports/TenantStatementReport.jsx`
8. `/apps/web/src/components/Properties/RentRollCard.jsx`
9. `/apps/web/src/components/Landlords/StatementCard.jsx`
10. `/apps/web/src/components/Tenants/TenantReadOnlyView.jsx`
11. `/apps/web/src/app/payments/open-balances/page.jsx`
12. `/apps/web/src/app/payments/receipt/[id]/page.jsx`
13. `/apps/web/src/app/reports/payment-note/page.jsx`

## How to Update a File

### Step 1: Add Import
```javascript
import { generatePrintHtml, openPrintWindow } from "@/utils/printUtils";
```

### Step 2: Replace openPrintView Function
Replace the existing `openPrintView` function with code that:
1. Builds the header HTML
2. Builds the table content HTML
3. Calls `generatePrintHtml()`
4. Calls `openPrintWindow()`

### Example Implementation

```javascript
const openPrintView = useCallback(
  (autoPrint) => {
    if (typeof window === "undefined") return;

    // 1. Build header HTML (will repeat on each page)
    const headerHtml = `
      <h1>Report Title</h1>
      <div class="meta">
        <div><span class="font-bold">Landlord:</span> ${landlordName}</div>
        <div><span class="font-bold">Period:</span> ${period}</div>
      </div>
    `;

    // 2. Build table content HTML
    const fmtMoney = (val) => {
      if (val === null || val === undefined || val === "") return "";
      const n = Number(val);
      if (!Number.isFinite(n)) return "";
      return new Intl.NumberFormat("en-UG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);
    };

    let tableRows = "";
    rows.forEach((row) => {
      tableRows += `
        <tr>
          <td>${row.col1}</td>
          <td class="text-right">${fmtMoney(row.col2)}</td>
        </tr>
      `;
    });

    // Add totals row
    tableRows += `
      <tr class="totals-row">
        <td class="font-bold text-slate-900">TOTAL</td>
        <td class="text-right font-bold text-slate-900">${fmtMoney(total)}</td>
      </tr>
    `;

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th>Column 1</th>
            <th class="text-right">Column 2</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    // 3. Generate professional print HTML
    const html = generatePrintHtml({
      title: "Report Title",
      headerHtml,
      contentHtml,
      landscape: false, // or true for landscape
    });

    // 4. Open print window
    openPrintWindow(html, autoPrint);
  },
  [/* dependencies */],
);
```

## Key Features Explained

### Page Numbering
- Automatically shows "Page X of Y" in the bottom-right footer
- Uses CSS `@page` rules for professional pagination
- Works in both print preview and PDF export

### Repeating Headers
- The `headerHtml` content automatically repeats on every page
- Perfect for report title, filters, and metadata

### Table Headers
- Table `<thead>` automatically repeats on new pages
- No manual intervention needed

### Clean Page Breaks
- Rows never split across pages (`page-break-inside: avoid`)
- Totals stay with their data (`page-break-before: avoid`)
- Orphaned headers prevented

### Styling Classes Available
Use these classes in your HTML content:
- `.text-right` - Right-align text
- `.text-center` - Center-align text
- `.font-medium` - Medium font weight
- `.font-bold` - Bold font weight
- `.totals-row` - Special styling for totals rows
- `.text-emerald-600` - Green text
- `.text-red-600` - Red text
- `.text-slate-NNN` - Gray text variants

## Orientation
- **Portrait**: `landscape: false` (default)
- **Landscape**: `landscape: true`

Use landscape for wide tables with many columns.

## Testing Checklist

After updating a file, test:
1. ✅ Print preview opens correctly
2. ✅ Page numbers show "Page X of Y"
3. ✅ Headers repeat on multiple pages (test with lots of data)
4. ✅ Table headers repeat on page breaks
5. ✅ No rows are cut in half across pages
6. ✅ Totals stay with data
7. ✅ Margins look professional
8. ✅ Text wraps in narrow cells
9. ✅ PDF export works (Chrome: Save as PDF)
10. ✅ Physical printing works

## Notes

- The print utility handles all CSS automatically
- No need to manually create print stylesheets
- The utility is framework-agnostic and can be used anywhere
- Always test with varying amounts of data to ensure pagination works correctly
