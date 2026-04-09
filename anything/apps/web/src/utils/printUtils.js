/**
 * Professional Print Utility
 *
 * Generates properly formatted print/PDF documents with:
 * - Correct page numbering (Page X of Y)
 * - Repeating headers on each page
 * - Clean table breaks (no row splitting)
 * - Proper margins and spacing
 */

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Generate professional print HTML with correct page numbering
 * @param {Object} options
 * @param {string} options.title - Document title
 * @param {string} options.headerHtml - HTML for report header (will repeat on each page)
 * @param {string} options.contentHtml - Main content HTML (tables, etc.)
 * @param {string} options.footerHtml - Optional footer content (totals, notes, etc.)
 * @param {boolean} options.landscape - Use landscape orientation (default: false)
 * @returns {string} Complete HTML document
 */
export function generatePrintHtml({
  title,
  headerHtml,
  contentHtml,
  footerHtml = "",
  landscape = false,
}) {
  const now = new Date();
  const printDateTime = now.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const orientation = landscape ? "landscape" : "portrait";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      /* Page setup with proper margins and space for footer */
      @page { 
        size: ${orientation};
        margin: 0.6in 0.75in 0.85in 0.75in; /* top, right, bottom (space for page number), left */
      }

      /* Reset and base styles */
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        font-size: 11px;
        line-height: 1.4;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        counter-reset: page;
      }

      /* Print metadata (top right) */
      .print-metadata {
        position: absolute;
        top: -0.4in;
        right: 0;
        font-size: 9px;
        color: #64748b;
      }

      /* Report header - repeats on every page */
      .report-header {
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 2px solid #334155;
      }

      .report-header h1 {
        font-size: 14px;
        font-weight: 700;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
        color: #0f172a;
      }

      .report-header .meta {
        font-size: 10px;
        color: #475569;
        text-align: center;
        margin-top: 3px;
      }

      /* Table styles */
      table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
        margin-top: 6px;
      }

      /* Table headers repeat on new pages */
      thead {
        display: table-header-group;
      }

      /* Prevent row splitting across pages */
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 600;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        padding: 6px 7px;
        border-bottom: 2px solid #334155;
        text-align: left;
        vertical-align: middle;
      }

      td {
        padding: 5px 7px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 10px;
        vertical-align: top;
        /* Allow text wrapping */
        word-wrap: break-word;
        word-break: break-word;
      }

      /* Alignment utilities */
      .text-right {
        text-align: right;
      }

      .text-center {
        text-align: center;
      }

      /* Totals row - avoid page break */
      .totals-row {
        page-break-inside: avoid !important;
        page-break-before: avoid !important;
        border-top: 2px solid #334155 !important;
        border-bottom: 2px solid #334155 !important;
        background: #f8fafc;
      }

      .totals-row td {
        font-weight: 700;
        padding: 8px 7px;
        color: #0f172a;
        border-bottom: 2px solid #334155 !important;
      }

      /* Footer section - avoid page break */
      .report-footer-content {
        page-break-inside: avoid !important;
        page-break-before: avoid !important;
        margin-top: 18px;
        padding-top: 12px;
        border-top: 2px solid #334155;
      }

      /* Page number footer - using running element */
      .page-number-container {
        position: running(footer);
      }

      /* Print-specific styles */
      @media print {
        body {
          margin: 0;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        /* Force header to repeat */
        thead {
          display: table-header-group;
        }

        /* Page numbers in bottom-right corner */
        @page {
          @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10px;
            color: #64748b;
            font-weight: 500;
            padding-bottom: 0.15in;
          }
        }

        /* Avoid orphaned headers */
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
        }

        /* Keep totals with content */
        .totals-row,
        .report-footer-content {
          page-break-before: avoid !important;
          page-break-inside: avoid !important;
        }

        /* Hide any duplicate page number elements */
        .page-footer,
        .page-number-footer,
        #page-number {
          display: none !important;
        }
      }

      /* Additional helper classes */
      .font-medium {
        font-weight: 500;
      }

      .font-bold {
        font-weight: 700;
      }

      .whitespace-nowrap {
        white-space: nowrap;
      }

      /* Highlight styles */
      .text-emerald-600 {
        color: #059669;
      }

      .text-red-600 {
        color: #dc2626;
      }

      .text-slate-400 {
        color: #94a3b8;
      }

      .text-slate-500 {
        color: #64748b;
      }

      .text-slate-600 {
        color: #475569;
      }

      .text-slate-700 {
        color: #334155;
      }

      .text-slate-800 {
        color: #1e293b;
      }

      .text-slate-900 {
        color: #0f172a;
      }

      .bg-slate-50 {
        background: #f8fafc;
      }

      .bg-gray-50 {
        background: #f9fafb;
      }
    </style>
  </head>
  <body>
    <div class="print-metadata">Printed: ${escapeHtml(printDateTime)}</div>
    
    <div class="report-header">
      ${headerHtml}
    </div>

    <div class="report-content">
      ${contentHtml}
    </div>

    ${footerHtml ? `<div class="report-footer-content">${footerHtml}</div>` : ""}
  </body>
</html>`;
}

/**
 * Open a print preview window with the generated HTML
 * @param {string} html - Complete HTML document
 * @param {boolean} autoPrint - Whether to automatically trigger print dialog
 */
export function openPrintWindow(html, autoPrint = false) {
  if (typeof window === "undefined") return;

  const w = window.open("", "_blank");
  if (!w) {
    console.error("Failed to open print window. Pop-up may be blocked.");
    return;
  }

  w.document.open();
  w.document.write(html);
  w.document.close();

  if (autoPrint) {
    w.focus();
    // Wait for content to load and render before printing
    setTimeout(() => {
      try {
        w.print();
      } catch (e) {
        console.error("Print failed", e);
      }
    }, 600);
  }
}
