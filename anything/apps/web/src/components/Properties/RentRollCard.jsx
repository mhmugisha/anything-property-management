import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, Printer, X } from "lucide-react";
import { fetchJson } from "@/utils/api";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatCurrencyUGX } from "@/utils/formatters";

/**
 * Format a date value (ISO string or YYYY-MM-DD) into DD-MM-YYYY.
 * Uses string slicing to avoid timezone shift issues that occur
 * when `new Date("2025-10-01T00:00:00.000Z")` shifts to local tz.
 */
function fmtDateSafe(d) {
  if (!d) return "";
  const str = String(d);
  // If ISO string like "2025-10-01T00:00:00.000Z", grab first 10 chars
  const dateOnly = str.length >= 10 ? str.slice(0, 10) : str;
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return "";
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return "";
  return `${day}-${month}-${year}`;
}

export function RentRollCard({ properties, currentPropertyId }) {
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [asOfDate, setAsOfDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const searchRef = useRef(null);

  // Auto-select property if currentPropertyId is provided
  useEffect(() => {
    if (currentPropertyId) {
      setSelectedPropertyId(currentPropertyId);
      const prop = (properties || []).find((p) => p.id === currentPropertyId);
      if (prop) {
        setSearchText(prop.property_name || "");
      }
    }
  }, [currentPropertyId, properties]);

  // Find selected property label
  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return (properties || []).find((p) => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  // Autocomplete filter
  const filteredProperties = useMemo(() => {
    const list = properties || [];
    if (!searchText.trim()) return list;
    const lower = searchText.toLowerCase();
    return list.filter(
      (p) =>
        (p.property_name || "").toLowerCase().includes(lower) ||
        (p.address || "").toLowerCase().includes(lower),
    );
  }, [properties, searchText]);

  const onSelectProperty = useCallback((prop) => {
    setSelectedPropertyId(prop.id);
    setSearchText(prop.property_name || "");
    setShowDropdown(false);
  }, []);

  const onClearProperty = useCallback(() => {
    setSelectedPropertyId(null);
    setSearchText("");
  }, []);

  // Fetch rent roll data
  const rentRollQuery = useQuery({
    queryKey: ["rentRoll", selectedPropertyId, asOfDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("propertyId", String(selectedPropertyId));
      if (asOfDate) params.set("asOfDate", asOfDate);
      return await fetchJson(`/api/reports/rent-roll?${params.toString()}`);
    },
    enabled: !!selectedPropertyId,
  });

  const data = rentRollQuery.data || null;
  const rows = data?.rows || [];
  const summary = data?.summary || null;
  const propertyInfo = data?.property || null;

  const hasRows = rows.length > 0;

  // Calculate totals for the table
  const totals = useMemo(() => {
    const actualRent = rows
      .filter((r) => r.status !== "Vacant")
      .reduce((sum, r) => sum + (r.monthly_rent || 0), 0);

    const potentialRent = rows.reduce(
      (sum, r) => sum + (r.monthly_rent || 0),
      0,
    );

    const totalDepositHeld = rows.reduce(
      (sum, r) => sum + (r.deposit_held || 0),
      0,
    );

    const totalBalance = rows
      .filter((r) => r.status !== "Vacant")
      .reduce((sum, r) => sum + (r.balance || 0), 0);

    return {
      actualRent,
      potentialRent,
      totalDepositHeld,
      totalBalance,
    };
  }, [rows]);

  // PDF generation
  const openPrintView = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!data || !propertyInfo) return;

    const escapeHtml = (str) =>
      String(str || "")
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

    const fmtDate = (d) => {
      if (!d) return "";
      const str = String(d);
      const dateOnly = str.length >= 10 ? str.slice(0, 10) : str;
      const parts = dateOnly.split("-");
      if (parts.length !== 3) return "";
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    const asOfFormatted = fmtDate(asOfDate);
    const now = new Date();
    const generatedAt = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const title = `RENT ROLL FOR ${escapeHtml(propertyInfo.property_name)} AS OF ${asOfFormatted}`;
    const landlord = propertyInfo.landlord_name
      ? `Landlord: ${escapeHtml(propertyInfo.landlord_name)}`
      : "";

    // Build table rows
    let tableRows = "";
    rows.forEach((r) => {
      const isVacant = r.status === "Vacant";
      const isActive = r.status === "Active";
      const hasOverdueBalance = isActive && r.balance > 0;
      const rowClass = isVacant ? "vacant-row" : "";
      const balanceClass = hasOverdueBalance ? "overdue" : "";

      tableRows += `<tr class="${rowClass}">
        <td>${escapeHtml(r.unit)}</td>
        <td>${isVacant ? "" : escapeHtml(r.tenant_name)}</td>
        <td class="center">${isVacant ? "" : fmtDate(r.lease_start)}</td>
        <td class="center">${isVacant ? "" : fmtDate(r.lease_end)}</td>
        <td class="right">${r.monthly_rent !== null ? fmtMoney(r.monthly_rent) : ""}</td>
        <td class="right">${r.deposit_held !== null ? fmtMoney(r.deposit_held) : ""}</td>
        <td class="right ${balanceClass}">${r.balance !== null ? fmtMoney(r.balance) : "—"}</td>
        <td class="center">${escapeHtml(r.status)}</td>
      </tr>`;
    });

    // Add totals row
    tableRows += `<tr style="border-top: 2px solid #334155; border-bottom: 2px solid #334155; background: #f8fafc;">
      <td colspan="4" style="font-weight: 700; padding: 10px 8px;">Totals</td>
      <td class="right" style="font-weight: 700; padding: 10px 8px;">${fmtMoney(totals.potentialRent)}</td>
      <td class="right" style="font-weight: 700; padding: 10px 8px;">${fmtMoney(totals.totalDepositHeld)}</td>
      <td class="right" style="font-weight: 700; padding: 10px 8px;">${fmtMoney(totals.totalBalance)}</td>
      <td></td>
    </tr>`;

    const s = summary || {};

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 1in 0.8in;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 10px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Header */
    .report-header {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #334155;
    }
    .report-header h1 {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .report-header h2 {
      font-size: 12px;
      font-weight: 500;
      color: #475569;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-top: 8px;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 8px 8px;
      border-bottom: 2px solid #334155;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10px;
      vertical-align: middle;
    }
    .right { text-align: right; }
    .center { text-align: center; }
    .vacant-row { background: #f8fafc; color: #94a3b8; }
    .overdue { color: #dc2626; font-weight: 600; }

    /* Summary */
    .summary-section {
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .summary-section h3 {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #1e293b;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .summary-card .label {
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 3px;
    }
    .summary-card .value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-align: right;
    }

    /* Footer */
    .report-footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
    }

    @media print {
      body { margin: 0; }
      .report-footer .page-number::after {
        content: counter(page) " of " counter(pages);
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${title}</h1>
    ${landlord ? `<h2>${landlord}</h2>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>Unit</th>
        <th>Tenant Name</th>
        <th class="center">Lease Start</th>
        <th class="center">Lease End</th>
        <th class="right">Monthly Rent (UGX)</th>
        <th class="right">Deposit Held (UGX)</th>
        <th class="right">Balance (UGX)</th>
        <th class="center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="report-footer">
    <div>Generated on: ${generatedAt}</div>
    <div class="page-number"></div>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();

    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch (e) {
        console.error("Print failed", e);
      }
    }, 400);
  }, [data, propertyInfo, rows, summary, asOfDate, totals]);

  const dropdownVisible = showDropdown && filteredProperties.length > 0;

  return (
    <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <div className="text-sm font-semibold text-slate-800">
              Rent Roll
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {currentPropertyId
              ? "Pick a date, then generate a printable PDF."
              : "Search for a property, pick a date, then generate a printable PDF."}
          </div>
        </div>
        <button
          type="button"
          onClick={openPrintView}
          disabled={!hasRows}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          Print/PDF
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Property search - only show if no currentPropertyId */}
        {!currentPropertyId && (
          <div className="md:col-span-2 space-y-1">
            <div className="text-xs font-medium text-slate-600">Property</div>
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setShowDropdown(true);
                    if (!e.target.value.trim()) setSelectedPropertyId(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search property by name or address..."
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
                {selectedPropertyId && (
                  <button
                    type="button"
                    onClick={onClearProperty}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {dropdownVisible && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredProperties.map((p) => {
                    const isSelected = p.id === selectedPropertyId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectProperty(p)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${isSelected ? "bg-sky-50 font-medium" : ""}`}
                      >
                        <div className="font-medium text-slate-800">
                          {p.property_name}
                        </div>
                        {p.address && (
                          <div className="text-xs text-slate-500 truncate">
                            {p.address}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* As-of date */}
        <div
          className={`space-y-1 ${currentPropertyId ? "md:col-span-3" : ""}`}
        >
          <div className="text-xs font-medium text-slate-600">As of Date</div>
          <DatePopoverInput
            value={asOfDate}
            onChange={setAsOfDate}
            placeholder="DD-MM-YYYY"
            className="bg-white"
          />
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {dropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Results preview */}
      {selectedPropertyId && (
        <div className="mt-4">
          {rentRollQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading rent roll…</div>
          ) : rentRollQuery.error ? (
            <div className="text-sm text-rose-600">
              Could not load rent roll data.
            </div>
          ) : !hasRows ? (
            <div className="text-sm text-slate-500">
              No units found for this property.
            </div>
          ) : (
            <>
              {/* Heading */}
              {propertyInfo && (
                <div className="mb-3">
                  <div className="text-sm font-semibold text-slate-800">
                    Rent Roll for {propertyInfo.property_name} as of{" "}
                    {fmtDateSafe(asOfDate)}
                  </div>
                  {propertyInfo.landlord_name && (
                    <div className="text-xs text-slate-500">
                      Landlord: {propertyInfo.landlord_name}
                    </div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-auto rounded-xl border border-gray-100 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                      <th className="py-2 px-3 whitespace-nowrap">Unit</th>
                      <th className="py-2 px-3">Tenant Name</th>
                      <th className="py-2 px-3 whitespace-nowrap text-center">
                        Lease Start
                      </th>
                      <th className="py-2 px-3 whitespace-nowrap text-center">
                        Lease End
                      </th>
                      <th className="py-2 px-3 whitespace-nowrap text-right">
                        Monthly Rent
                      </th>
                      <th className="py-2 px-3 whitespace-nowrap text-right">
                        Deposit Held
                      </th>
                      <th className="py-2 px-3 whitespace-nowrap text-right">
                        Balance
                      </th>
                      <th className="py-2 px-3 whitespace-nowrap text-center">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const isVacant = r.status === "Vacant";
                      const isActive = r.status === "Active";
                      const hasOverdueBalance = isActive && r.balance > 0;
                      const rowBg = isVacant ? "bg-gray-50" : "";
                      const rowTextColor = isVacant ? "text-slate-400" : "";
                      const balanceColor = hasOverdueBalance
                        ? "text-red-600 font-semibold"
                        : "";
                      const statusColor = isVacant
                        ? "text-slate-400"
                        : "text-emerald-600";

                      return (
                        <tr
                          key={`${r.unit}-${idx}`}
                          className={`border-b last:border-b-0 ${rowBg} ${rowTextColor}`}
                        >
                          <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                            {r.unit}
                          </td>
                          <td className="py-2 px-3">{r.tenant_name || ""}</td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {r.lease_start ? fmtDateSafe(r.lease_start) : ""}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {r.lease_end ? fmtDateSafe(r.lease_end) : ""}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {r.monthly_rent !== null
                              ? formatCurrencyUGX(r.monthly_rent)
                              : ""}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {r.deposit_held !== null
                              ? formatCurrencyUGX(r.deposit_held)
                              : ""}
                          </td>
                          <td
                            className={`py-2 px-3 text-right whitespace-nowrap ${balanceColor}`}
                          >
                            {r.balance !== null
                              ? formatCurrencyUGX(r.balance)
                              : "—"}
                          </td>
                          <td
                            className={`py-2 px-3 text-center whitespace-nowrap ${statusColor}`}
                          >
                            {r.status}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals Row */}
                    <tr className="border-t-2 border-b-2 border-slate-700 bg-slate-50">
                      <td
                        className="py-3 px-3 font-bold text-slate-900"
                        colSpan="4"
                      >
                        Totals
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrencyUGX(totals.potentialRent)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrencyUGX(totals.totalDepositHeld)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrencyUGX(totals.totalBalance)}
                      </td>
                      <td className="py-3 px-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary cards */}
              {summary && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SummaryItem
                    label="Actual Rent (UGX)"
                    value={formatCurrencyUGX(totals.actualRent)}
                  />
                  <SummaryItem
                    label="Potential Rent (UGX)"
                    value={formatCurrencyUGX(totals.potentialRent)}
                  />
                  <SummaryItem
                    label="Total Units"
                    value={summary.total_units}
                  />
                  <SummaryItem
                    label="Occupied"
                    value={summary.occupied_units}
                  />
                  <SummaryItem label="Vacant" value={summary.vacant_units} />
                  <SummaryItem
                    label="Occupancy Rate"
                    value={`${summary.occupancy_rate}%`}
                  />
                  <SummaryItem
                    label="Outstanding Balance (UGX)"
                    value={formatCurrencyUGX(summary.total_outstanding_balance)}
                    highlight={summary.total_outstanding_balance > 0}
                  />
                  <SummaryItem
                    label="Deposits Held (UGX)"
                    value={formatCurrencyUGX(summary.total_deposits_held)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div
        className={`text-base font-semibold text-right ${highlight ? "text-red-600" : "text-slate-800"}`}
      >
        {value}
      </div>
    </div>
  );
}
