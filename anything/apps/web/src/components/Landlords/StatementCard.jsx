import { FileText, Download, Eye, Printer } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import DatePopoverInput from "@/components/DatePopoverInput";
import { Field } from "./Field";
import { SummaryCard } from "./SummaryCard";
import { formatCurrencyUGX, formatDate } from "@/utils/formatters";
import { downloadCsv } from "@/utils/downloadCsv";

export function StatementCard({
  properties,
  selectedPropertyId,
  onPropertyChange,
  from,
  to,
  onFromChange,
  onToChange,
  statementHeading,
  isLoading,
  error,
  rows,
  summary,
  canReports,
}) {
  const printRef = useRef(null);
  const safeFilenameBase = useMemo(() => {
    const base = statementHeading || "landlord-statement";
    const cleaned = String(base)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return cleaned || "landlord-statement";
  }, [statementHeading]);

  const canExport = canReports && Array.isArray(rows) && rows.length > 0;

  const onExport = useCallback(() => {
    if (!canExport) return;

    const exportRows = rows.map((r) => {
      const dateValue = r?.date ? String(r.date).slice(0, 10) : "";
      return {
        Date: dateValue,
        Description: r?.description || "",
        "Debit (UGX)":
          r?.debit != null && r.debit !== "" ? Number(r.debit) : "",
        "Credit (UGX)":
          r?.credit != null && r.credit !== "" ? Number(r.credit) : "",
        "Balance (UGX)":
          r?.balance != null && r.balance !== "" ? Number(r.balance) : "",
      };
    });

    const today = new Date().toISOString().slice(0, 10);
    const filename = `${safeFilenameBase}-${today}.csv`;
    downloadCsv(filename, exportRows);
  }, [canExport, rows, safeFilenameBase]);

  const openPrintView = useCallback(
    (autoPrint) => {
      if (typeof window === "undefined") return;

      const node = printRef?.current;
      if (!node) return;

      const clone = node.cloneNode(true);
      // Remove no-print elements (filters, buttons)
      const noPrintNodes = clone.querySelectorAll('[data-no-print="true"]');
      for (const el of noPrintNodes) el.remove();

      const escapeHtml = (str) =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const fmtMoney = (val) => {
        if (val === null || val === undefined || val === "") return "";
        const n = Number(val);
        if (!Number.isFinite(n)) return "";
        return new Intl.NumberFormat("en-UG", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(n);
      };

      const title = statementHeading || "Landlord Statement";

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: portrait; margin: 0.5in; }
      body { 
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; 
        margin: 20px; 
        color: #0f172a; 
        font-size: 11px; 
      }
      h1, h2, h3 { margin: 0 0 8px 0; }
      h1 { font-size: 18px; font-weight: 700; }
      h2 { font-size: 14px; font-weight: 600; }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        page-break-inside: auto; 
        margin-top: 12px;
      }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td { 
        padding: 8px 10px; 
        border-bottom: 1px solid #d1d5db; 
        vertical-align: top; 
      }
      th { 
        text-align: left; 
        color: #475569; 
        font-weight: 600; 
        background: #f1f5f9; 
        border-bottom: 2px solid #1e293b;
      }
      .text-right { text-align: right; }
      .font-medium { font-weight: 500; }
      .font-bold { font-weight: 700; }
      .statement-header {
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e5e7eb;
      }
      @media print {
        body { margin: 0; }
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    ${clone.innerHTML}
  </body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();

      if (autoPrint) {
        w.focus();
        setTimeout(() => {
          try {
            w.print();
          } catch (e) {
            console.error("Print failed", e);
          }
        }, 300);
      }
    },
    [statementHeading],
  );

  const normalizeDateValue = (value) => {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "string") {
      // Accept YYYY-MM-DD and also ISO timestamps (YYYY-MM-DDTHH:mm:ss...)
      if (value.length >= 10) return value.slice(0, 10);
      return "";
    }
    return "";
  };

  const fromValue = normalizeDateValue(from);
  const toValue = normalizeDateValue(to);

  const errorText = useMemo(() => {
    if (!error) return null;
    const msg = typeof error?.message === "string" ? error.message : null;
    return msg || "Could not load statement.";
  }, [error]);

  return (
    <div
      className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4"
      ref={printRef}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" data-no-print="true" />
            <div className="text-sm font-semibold text-slate-800">
              Statement
            </div>
          </div>
          <div className="text-xs text-slate-500" data-no-print="true">
            Select a property then filter dates.
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto" data-no-print="true">
          {!canReports ? (
            <div className="text-xs text-rose-600">
              You need Reports access to view statements.
            </div>
          ) : null}

          <button
            type="button"
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            title={
              canExport
                ? "Downloads a CSV that opens in Excel"
                : "Select a period with rows to export"
            }
          >
            <Download className="w-4 h-4" />
            Export To Excel
          </button>
          <button
            type="button"
            onClick={() => openPrintView(true)}
            disabled={!canExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </button>
        </div>
      </div>

      <div
        className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"
        data-no-print="true"
      >
        <Field label="Property">
          <select
            value={selectedPropertyId}
            onChange={(e) => onPropertyChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          >
            <option value="">Select property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.property_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <DatePopoverInput
            value={fromValue}
            onChange={onFromChange}
            placeholder="DD-MM-YYYY"
            className="bg-white"
          />
        </Field>
        <Field label="To">
          <DatePopoverInput
            value={toValue}
            onChange={onToChange}
            placeholder="DD-MM-YYYY"
            className="bg-white"
          />
        </Field>
      </div>

      {statementHeading ? (
        <div className="statement-header">
          <h1>{statementHeading}</h1>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-3 text-sm text-slate-500">Loading statement…</div>
      ) : error ? (
        <div className="mt-3 text-sm text-rose-600">
          <div>Could not load statement.</div>
          {errorText ? (
            <div className="mt-1 text-xs text-rose-700">{errorText}</div>
          ) : null}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-sm text-slate-500">
          No statement rows in this period.
        </div>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Bold separator line between headers and first entry */}
              <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Debit (UGX)</th>
                <th className="py-2 pr-3 text-right">Credit (UGX)</th>
                <th className="py-2 pr-3 text-right">Balance (UGX)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const debitText = r.debit ? formatCurrencyUGX(r.debit) : "";
                const creditText = r.credit ? formatCurrencyUGX(r.credit) : "";
                const balanceText = formatCurrencyUGX(r.balance);
                const dateText = formatDate(r.date);
                const key = `${r.kind}-${idx}-${r.date}`;

                return (
                  <tr key={key} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{dateText}</td>
                    <td className="py-2 pr-3">{r.description}</td>
                    <td className="py-2 pr-3 text-right">{debitText}</td>
                    <td className="py-2 pr-3 text-right">{creditText}</td>
                    <td className="py-2 pr-3 text-right font-medium">
                      {balanceText}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              {summary ? (
                <tr className="border-t-2 border-slate-700">
                  <td className="py-2 pr-3 font-bold" colSpan="2">
                    Totals
                  </td>
                  <td className="py-2 pr-3 text-right font-bold">
                    {formatCurrencyUGX(summary.debits)}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold">
                    {formatCurrencyUGX(summary.credits)}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold">
                    {formatCurrencyUGX(summary.closing_balance)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {summary ? (
        <div
          className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3"
          data-no-print="true"
        >
          <SummaryCard
            title="Debits (Payouts + deductions) (UGX)"
            value={formatCurrencyUGX(summary.debits)}
            alignRight
          />
          <SummaryCard
            title="Credits (Rent payable) (UGX)"
            value={formatCurrencyUGX(summary.credits)}
            alignRight
          />
          <SummaryCard
            title="Closing balance (UGX)"
            value={formatCurrencyUGX(summary.closing_balance)}
            alignRight
          />
        </div>
      ) : null}
    </div>
  );
}
