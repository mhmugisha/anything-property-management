import { useState, useMemo, useCallback, useRef } from "react";
import DatePopoverInput from "@/components/DatePopoverInput";
import { FileSpreadsheet, Printer, Eye, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { downloadCsv } from "@/utils/downloadCsv";
import { useAllLandlordsBalances } from "@/hooks/useAllLandlordsBalances";
import { Field } from "@/components/Reports/Field";

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Default the date range to the current calendar month.
function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const first = `${y}-${pad2(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const last = `${y}-${pad2(m + 1)}-${pad2(lastDay)}`;
  return { first, last };
}

export function AllLandlordsBalancesReport({
  userLoading,
  user,
  canViewReports,
}) {
  const printRef = useRef(null);

  const initialRange = useMemo(() => currentMonthRange(), []);

  // Filters
  const [selectedLandlordId, setSelectedLandlordId] = useState(null);
  const [landlordSearch, setLandlordSearch] = useState("");
  const [showLandlordDropdown, setShowLandlordDropdown] = useState(false);
  const [from, setFrom] = useState(initialRange.first);
  const [to, setTo] = useState(initialRange.last);

  // Lookups
  const landlordsQuery = useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/landlords");
      return data.landlords || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });

  const landlords = landlordsQuery.data || [];

  const filteredLandlords = useMemo(() => {
    if (!landlordSearch.trim()) return landlords;
    const lower = landlordSearch.toLowerCase();
    return landlords.filter((l) =>
      (l.full_name || "").toLowerCase().includes(lower),
    );
  }, [landlords, landlordSearch]);

  // Data
  const reportQuery = useAllLandlordsBalances(
    {
      landlordId: selectedLandlordId,
      from,
      to,
    },
    !userLoading && !!user && canViewReports,
  );

  const reportData = reportQuery.data || {};
  const landlordsList = reportData.landlords || [];
  const totals = reportData.totals || {
    opening_balance: 0,
    period_rent: 0,
    period_fees: 0,
    period_deductions: 0,
    period_maintenance: 0,
    period_payouts: 0,
    period_other: 0,
    closing_balance: 0,
  };

  const landlordLabel = useMemo(() => {
    if (!selectedLandlordId) return "All Landlords";
    const match = landlords.find((l) => Number(l.id) === selectedLandlordId);
    return match?.full_name || "—";
  }, [selectedLandlordId, landlords]);

  const dateRangeLabel = useMemo(() => {
    if (from && to) return `${from} to ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Up to ${to}`;
    return "—";
  }, [from, to]);

  const reportTitle = `All Landlords Balances – ${landlordLabel}`;

  const onSelectLandlord = useCallback((landlordObj) => {
    setSelectedLandlordId(Number(landlordObj.id));
    setLandlordSearch(landlordObj.full_name || "");
    setShowLandlordDropdown(false);
  }, []);

  const onClearLandlord = useCallback(() => {
    setSelectedLandlordId(null);
    setLandlordSearch("");
  }, []);

  // ---- Export: CSV / Excel ----
  const onExportCsv = useCallback(() => {
    const csvRows = landlordsList.map((l, idx) => ({
      "#": idx + 1,
      Landlord: l.landlord_name,
      "Opening Balance": l.opening_balance,
      Rent: l.period_rent,
      Fees: l.period_fees,
      Deductions: l.period_deductions,
      Maintenance: l.period_maintenance,
      Payouts: l.period_payouts,
      "Other Adjustments": l.period_other,
      "Closing Balance": l.closing_balance,
    }));

    csvRows.push({
      "#": "",
      Landlord: "TOTAL",
      "Opening Balance": totals.opening_balance,
      Rent: totals.period_rent,
      Fees: totals.period_fees,
      Deductions: totals.period_deductions,
      Maintenance: totals.period_maintenance,
      Payouts: totals.period_payouts,
      "Other Adjustments": totals.period_other,
      "Closing Balance": totals.closing_balance,
    });

    const filename = `all-landlords-balances-${selectedLandlordId || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, csvRows);
  }, [landlordsList, totals, selectedLandlordId]);

  // ---- Print / PDF ----
  const openPrintView = useCallback(
    (autoPrint) => {
      if (typeof window === "undefined") return;

      const node = printRef?.current;
      if (!node) return;

      const clone = node.cloneNode(true);
      const noPrintNodes = clone.querySelectorAll('[data-no-print="true"]');
      for (const el of noPrintNodes) el.remove();

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(reportTitle)}</title>
    <style>
      @page { size: landscape; margin: 0.5in; }
      body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 20px; color: #0f172a; font-size: 12px; }
      h1, h2, h3 { margin: 0 0 6px 0; }
      table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td { padding: 8px; border-bottom: 1px solid #d1d5db; vertical-align: top; }
      th { text-align: left; color: #475569; font-weight: 600; background: #f1f5f9; }
      .text-right { text-align: right; }
      .totals-row td { font-weight: 700; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b; background: #f8fafc; }
      .report-header { margin-bottom: 12px; text-align: center; }
      .report-header h1 { font-size: 18px; margin-bottom: 8px; }
      .report-header .meta { font-size: 12px; color: #475569; }
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
    [reportTitle],
  );

  const landlordDropdownVisible =
    showLandlordDropdown && filteredLandlords.length > 0;

  const hasData = landlordsList.length > 0;

  return (
    <div ref={printRef}>
      {/* Printable report header */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide text-center">
          All Landlords Balances
        </h1>
        <div className="mt-2 flex flex-col sm:flex-row sm:gap-8 sm:justify-center text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Landlord:</span>{" "}
            {landlordLabel}
          </div>
          <div>
            <span className="font-medium text-slate-700">Period:</span>{" "}
            {dateRangeLabel}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        data-no-print="true"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Landlord Search */}
          <Field label="Landlord">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={landlordSearch}
                  onChange={(e) => {
                    setLandlordSearch(e.target.value);
                    setShowLandlordDropdown(true);
                  }}
                  onFocus={() => setShowLandlordDropdown(true)}
                  placeholder="All Landlords"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
                />
                {selectedLandlordId && (
                  <button
                    type="button"
                    onClick={onClearLandlord}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {landlordDropdownVisible && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredLandlords.map((l) => {
                    const isSelected = Number(l.id) === selectedLandlordId;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onSelectLandlord(l)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                          isSelected ? "bg-sky-50 font-medium" : ""
                        }`}
                      >
                        <div className="font-medium text-slate-800">
                          {l.full_name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>

          {/* From Date */}
          <Field label="From Date">
            <DatePopoverInput
              value={from}
              onChange={setFrom}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>

          {/* To Date */}
          <Field label="To Date">
            <DatePopoverInput
              value={to}
              onChange={setTo}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {landlordDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowLandlordDropdown(false)}
        />
      )}

      {/* Toolbar */}
      <div
        className="flex flex-wrap gap-2 mb-4 justify-end"
        data-no-print="true"
      >
        <button
          type="button"
          onClick={onExportCsv}
          disabled={!hasData}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Excel / CSV
        </button>
        <button
          type="button"
          onClick={() => openPrintView(false)}
          disabled={!hasData}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          type="button"
          onClick={() => openPrintView(true)}
          disabled={!hasData}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50 text-sm"
        >
          <Printer className="w-4 h-4" />
          Print / PDF
        </button>
      </div>

      {/* Report table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {reportQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading report…</p>
        ) : reportQuery.error ? (
          <p className="text-sm text-rose-600">
            {reportQuery.error.message || "Could not load report."}
          </p>
        ) : landlordsList.length === 0 ? (
          <p className="text-sm text-slate-500">
            No landlords found for the selected period.
          </p>
        ) : (
          <BalancesTable landlords={landlordsList} totals={totals} />
        )}
      </div>
    </div>
  );
}

function BalancesTable({ landlords, totals }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm" style={{ minWidth: 1100 }}>
        <thead>
          <tr className="text-left text-slate-500 border-b-2 border-slate-700">
            <th className="py-2 pr-3" style={{ width: "60px" }}>
              #
            </th>
            <th className="py-2 pr-3">Landlord</th>
            <th className="py-2 pr-3 text-right">Opening Balance</th>
            <th className="py-2 pr-3 text-right">Rent</th>
            <th className="py-2 pr-3 text-right">Fees</th>
            <th className="py-2 pr-3 text-right">Deductions</th>
            <th className="py-2 pr-3 text-right">Maintenance</th>
            <th className="py-2 pr-3 text-right">Payouts</th>
            <th className="py-2 pr-3 text-right">Other Adj.</th>
            <th className="py-2 pr-3 text-right">Closing Balance</th>
          </tr>
        </thead>
        <tbody>
          {landlords.map((l, idx) => (
            <tr
              key={l.landlord_id}
              className="border-b last:border-b-0 hover:bg-slate-50"
            >
              <td className="py-2 pr-3 text-slate-700">{idx + 1}</td>
              <td className="py-2 pr-3 font-medium text-slate-800">
                {l.landlord_name}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.opening_balance)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.period_rent)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.period_fees)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.period_deductions)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.period_maintenance)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.period_payouts)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.period_other)}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                {formatCurrencyUGX(l.closing_balance)}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="totals-row border-t-2 border-slate-700 bg-slate-50">
            <td className="py-2 pr-3 font-bold text-slate-900" colSpan={2}>
              TOTAL
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.opening_balance)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.period_rent)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.period_fees)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.period_deductions)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.period_maintenance)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.period_payouts)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.period_other)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.closing_balance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
