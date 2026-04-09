import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FileSpreadsheet, Printer, Eye, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { downloadCsv } from "@/utils/downloadCsv";
import { useConsolidatedBalancesDue } from "@/hooks/useConsolidatedBalancesDue";
import { Field } from "@/components/Reports/Field";
import { generatePrintHtml, openPrintWindow } from "@/utils/printUtils";

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function ConsolidatedBalancesDueReport({
  userLoading,
  user,
  canViewReports,
}) {
  const printRef = useRef(null);

  // Filters - default to null (show all landlords)
  const [selectedLandlordId, setSelectedLandlordId] = useState(null);
  const [landlordSearch, setLandlordSearch] = useState("");
  const [showLandlordDropdown, setShowLandlordDropdown] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  // Filter landlords based on search
  const filteredLandlords = useMemo(() => {
    if (!landlordSearch.trim()) return landlords;
    const lower = landlordSearch.toLowerCase();
    return landlords.filter((l) =>
      (l.full_name || "").toLowerCase().includes(lower),
    );
  }, [landlords, landlordSearch]);

  // Data
  const reportQuery = useConsolidatedBalancesDue(
    {
      landlordId: selectedLandlordId,
      from,
      to,
    },
    !userLoading && !!user && canViewReports,
  );

  const reportData = reportQuery.data || {};
  const mode = reportData.mode || "all_landlords";
  const landlordsList = reportData.landlords || [];
  const properties = reportData.properties || [];
  const landlord = reportData.landlord || null;
  const totals = reportData.totals || {
    rent_total: 0,
    management_fees: 0,
    other_deductions: 0,
    total_deductions: 0,
    balance_due: 0,
  };

  const landlordLabel = useMemo(() => {
    if (!selectedLandlordId) return "All Landlords";
    return landlord?.full_name || "—";
  }, [selectedLandlordId, landlord]);

  const dateRangeLabel = useMemo(() => {
    if (!from && !to) return "All Time";
    if (from && to) return `${from} to ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Up to ${to}`;
    return "All Time";
  }, [from, to]);

  const reportTitle = `Consolidated Balances Due – ${landlordLabel}`;

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
    let csvRows = [];

    if (mode === "all_landlords") {
      // Export landlords list
      csvRows = landlordsList.map((l, idx) => ({
        "#": idx + 1,
        Landlord: l.landlord_name,
        "Rent Total": l.rent_total,
        "Management Fees": l.management_fees,
        "Other Deductions": l.other_deductions,
        "Total Deductions": l.total_deductions,
        "Balance Due": l.balance_due,
      }));
    } else {
      // Export properties for single landlord
      csvRows = properties.map((p, idx) => ({
        "#": idx + 1,
        Property: p.property_name,
        "Rent Total": p.rent_total,
        "Management Fees": p.management_fees,
        "Other Deductions": p.other_deductions,
        "Total Deductions": p.total_deductions,
        "Balance Due": p.balance_due,
      }));
    }

    // Add totals row
    csvRows.push({
      "#": "",
      [mode === "all_landlords" ? "Landlord" : "Property"]: "TOTAL",
      "Rent Total": totals.rent_total,
      "Management Fees": totals.management_fees,
      "Other Deductions": totals.other_deductions,
      "Total Deductions": totals.total_deductions,
      "Balance Due": totals.balance_due,
    });

    const filename = `consolidated-balances-due-${selectedLandlordId || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, csvRows);
  }, [landlordsList, properties, totals, selectedLandlordId, mode]);

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
      @page { size: portrait; margin: 0.5in; }
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

  const hasData =
    mode === "all_landlords" ? landlordsList.length > 0 : properties.length > 0;

  return (
    <div ref={printRef}>
      {/* Printable report header */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide text-center">
          Consolidated Balances Due
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
                    const isSelected = l.id === selectedLandlordId;
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
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            />
          </Field>

          {/* To Date */}
          <Field label="To Date">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
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
        ) : mode === "all_landlords" ? (
          landlordsList.length === 0 ? (
            <p className="text-sm text-slate-500">
              No landlords found with data in the selected period.
            </p>
          ) : (
            <LandlordsTable landlords={landlordsList} totals={totals} />
          )
        ) : properties.length === 0 ? (
          <p className="text-sm text-slate-500">
            No properties found for this landlord in the selected period.
          </p>
        ) : (
          <PropertiesTable properties={properties} totals={totals} />
        )}
      </div>
    </div>
  );
}

function LandlordsTable({ landlords, totals }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm" style={{ minWidth: 900 }}>
        <thead>
          <tr className="text-left text-slate-500 border-b-2 border-slate-700">
            <th className="py-2 pr-3" style={{ width: "60px" }}>
              #
            </th>
            <th className="py-2 pr-3">Landlord</th>
            <th className="py-2 pr-3 text-right">Rent Total</th>
            <th className="py-2 pr-3 text-right">Mgmt Fees</th>
            <th className="py-2 pr-3 text-right">Other Deductions</th>
            <th className="py-2 pr-3 text-right">Reversals</th>
            <th className="py-2 pr-3 text-right">Payouts</th>
            <th className="py-2 pr-3 text-right">Balance Due</th>
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
                {formatCurrencyUGX(l.rent_total)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.management_fees)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.other_deductions)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.reversals || 0)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(l.payouts || 0)}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                {formatCurrencyUGX(l.balance_due)}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="totals-row border-t-2 border-slate-700 bg-slate-50">
            <td className="py-2 pr-3 font-bold text-slate-900" colSpan={2}>
              TOTAL
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.rent_total)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.management_fees)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.other_deductions)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.reversals || 0)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.payouts || 0)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.balance_due)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PropertiesTable({ properties, totals }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm" style={{ minWidth: 800 }}>
        <thead>
          <tr className="text-left text-slate-500 border-b-2 border-slate-700">
            <th className="py-2 pr-3" style={{ width: "60px" }}>
              #
            </th>
            <th className="py-2 pr-3">Property</th>
            <th className="py-2 pr-3 text-right">Rent Total</th>
            <th className="py-2 pr-3 text-right">Mgmt Fees</th>
            <th className="py-2 pr-3 text-right">Other Deductions</th>
            <th className="py-2 pr-3 text-right">Total Deductions</th>
            <th className="py-2 pr-3 text-right">Balance Due</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p, idx) => (
            <tr
              key={p.property_id}
              className="border-b last:border-b-0 hover:bg-slate-50"
            >
              <td className="py-2 pr-3 text-slate-700">{idx + 1}</td>
              <td className="py-2 pr-3 font-medium text-slate-800">
                {p.property_name}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(p.rent_total)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(p.management_fees)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(p.other_deductions)}
              </td>
              <td className="py-2 pr-3 text-right text-slate-700">
                {formatCurrencyUGX(p.total_deductions)}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                {formatCurrencyUGX(p.balance_due)}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="totals-row border-t-2 border-slate-700 bg-slate-50">
            <td className="py-2 pr-3 font-bold text-slate-900" colSpan={2}>
              TOTAL
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.rent_total)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.management_fees)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.other_deductions)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.total_deductions)}
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totals.balance_due)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
