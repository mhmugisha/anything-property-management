import { useState, useMemo, useCallback, useRef } from "react";
import { FileSpreadsheet, Printer, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { downloadCsv } from "@/utils/downloadCsv";
import { useLandlordPayableBalances } from "@/hooks/useLandlordPayableBalances";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDefaultMonth() {
  const now = new Date();
  return now.getMonth() + 1;
}

function getDefaultYear() {
  return new Date().getFullYear();
}

function buildYearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current + 1; y >= 2020; y--) {
    years.push(y);
  }
  return years;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function LandlordPayableBalancesReport({
  userLoading,
  user,
  canViewReports,
}) {
  const printRef = useRef(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [selectedYear, setSelectedYear] = useState(getDefaultYear);
  const [selectedLandlordId, setSelectedLandlordId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  // Lookups
  const landlordsQuery = useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/landlords");
      return data.landlords || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });

  const propertiesQuery = useQuery({
    queryKey: ["lookups", "properties", selectedLandlordId],
    queryFn: async () => {
      const qs = selectedLandlordId ? `?landlordId=${selectedLandlordId}` : "";
      const data = await fetchJson(`/api/lookups/properties${qs}`);
      return data.properties || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });

  const landlords = landlordsQuery.data || [];
  const properties = propertiesQuery.data || [];

  // When landlord changes, reset property
  const onLandlordChange = useCallback((e) => {
    setSelectedLandlordId(e.target.value);
    setSelectedPropertyId("");
  }, []);

  // Data
  const reportQuery = useLandlordPayableBalances(
    {
      month: selectedMonth,
      year: selectedYear,
      landlordId: selectedLandlordId,
      propertyId: selectedPropertyId,
    },
    !userLoading && !!user && canViewReports,
  );

  const rows = reportQuery.data?.landlords || [];
  const totalAmountDue = reportQuery.data?.total_amount_due || 0;

  const selectedMonthLabel = MONTH_NAMES[selectedMonth - 1] || "";
  const reportTitle = `Landlord Payable Balances – ${selectedMonthLabel} ${selectedYear}`;

  // Determine the landlord / property labels for the header
  const landlordLabel = useMemo(() => {
    if (!selectedLandlordId) return "All Landlords";
    const found = landlords.find(
      (l) => String(l.id) === String(selectedLandlordId),
    );
    return found ? found.full_name : "—";
  }, [selectedLandlordId, landlords]);

  const propertyLabel = useMemo(() => {
    if (!selectedPropertyId) return "All Properties";
    const found = properties.find(
      (p) => String(p.id) === String(selectedPropertyId),
    );
    return found ? found.property_name : "—";
  }, [selectedPropertyId, properties]);

  // ---- Export: CSV / Excel ----
  const onExportCsv = useCallback(() => {
    const csvRows = rows.map((r, idx) => ({
      "No.": idx + 1,
      "Due Date": r.formatted_due_date || "—",
      "Landlord Name": r.landlord_name,
      "Amount Due": r.amount_due,
    }));

    // Add totals row
    csvRows.push({
      "No.": "",
      "Due Date": "",
      "Landlord Name": "TOTAL",
      "Amount Due": totalAmountDue,
    });

    const filename = `landlord-payable-balances-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
    downloadCsv(filename, csvRows);
  }, [rows, totalAmountDue, selectedMonth, selectedYear]);

  // ---- Print / PDF ----
  const openPrintView = useCallback(
    (autoPrint) => {
      if (typeof window === "undefined") return;

      const node = printRef?.current;
      if (!node) return;

      const clone = node.cloneNode(true);
      // Remove no-print elements (filters, buttons)
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

  const yearOptions = useMemo(() => buildYearOptions(), []);

  return (
    <div ref={printRef}>
      {/* Printable report header (visible always, shown on print) */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide text-center">
          {reportTitle}
        </h1>
        <div className="mt-2 flex flex-col sm:flex-row sm:gap-8 sm:justify-center text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Landlord:</span>{" "}
            {landlordLabel}
          </div>
          <div>
            <span className="font-medium text-slate-700">Property:</span>{" "}
            {propertyLabel}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        data-no-print="true"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Month */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Month *
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Year *
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Landlord */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Landlord
            </label>
            <select
              value={selectedLandlordId}
              onChange={onLandlordChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            >
              <option value="">All Landlords</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Property */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Property
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.property_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex flex-wrap gap-2 mb-4 justify-end"
        data-no-print="true"
      >
        <button
          type="button"
          onClick={onExportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Excel / CSV
        </button>
        <button
          type="button"
          onClick={() => openPrintView(false)}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-sm"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          type="button"
          onClick={() => openPrintView(true)}
          disabled={rows.length === 0}
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
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No unpaid balances for {selectedMonthLabel} {selectedYear}.
          </p>
        ) : (
          <ReportTable rows={rows} totalAmountDue={totalAmountDue} />
        )}
      </div>
    </div>
  );
}

function ReportTable({ rows, totalAmountDue }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm" style={{ minWidth: 600 }}>
        <thead>
          <tr className="text-left text-slate-500 border-b-2 border-slate-700">
            <th className="py-2 pr-3" style={{ width: "80px" }}>
              No.
            </th>
            <th className="py-2 pr-3" style={{ width: "150px" }}>
              Due Date
            </th>
            <th className="py-2 pr-3">Landlord Name</th>
            <th className="py-2 pr-3 text-right">Amount Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr
              key={r.landlord_id}
              className="border-b last:border-b-0 hover:bg-slate-50"
            >
              <td className="py-2 pr-3 text-slate-700">{idx + 1}</td>
              <td className="py-2 pr-3 text-slate-700">
                {r.formatted_due_date || "—"}
              </td>
              <td className="py-2 pr-3 font-medium text-slate-800">
                {r.landlord_name}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                {formatCurrencyUGX(r.amount_due)}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="totals-row border-t-2 border-slate-700 bg-slate-50">
            <td className="py-2 pr-3 font-bold text-slate-900" colSpan={3}>
              TOTAL AMOUNT PAYABLE TO LANDLORDS
            </td>
            <td className="py-2 pr-3 text-right font-bold text-slate-900">
              {formatCurrencyUGX(totalAmountDue)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
