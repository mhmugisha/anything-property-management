import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Printer, Eye } from "lucide-react";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatters";
import DatePopoverInput from "@/components/DatePopoverInput";

export function AllTenantsReport({ userLoading, user, canViewReports }) {
  const [landlordSearch, setLandlordSearch] = useState("");
  const [selectedLandlordId, setSelectedLandlordId] = useState("");
  const [showLandlordDropdown, setShowLandlordDropdown] = useState(false);

  const [propertySearch, setPropertySearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Fetch landlords for autocomplete
  const landlordsQuery = useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/landlords");
      return data.landlords || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });

  const landlords = landlordsQuery.data || [];

  // Fetch properties for autocomplete
  const propertiesQuery = useQuery({
    queryKey: ["lookups", "properties"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/properties");
      return data.properties || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });

  const properties = propertiesQuery.data || [];

  // Filter landlords based on search
  const filteredLandlords = useMemo(() => {
    if (!landlordSearch.trim()) return landlords;
    const lower = landlordSearch.toLowerCase();
    return landlords.filter(
      (l) =>
        (l.full_name || "").toLowerCase().includes(lower) ||
        (l.phone || "").toLowerCase().includes(lower),
    );
  }, [landlords, landlordSearch]);

  // Filter properties based on search AND selected landlord
  const filteredProperties = useMemo(() => {
    let filtered = properties;

    // First filter by selected landlord
    if (selectedLandlordId) {
      filtered = filtered.filter(
        (p) => String(p.landlord_id) === String(selectedLandlordId),
      );
    }

    // Then filter by search text
    if (propertySearch.trim()) {
      const lower = propertySearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.property_name || "").toLowerCase().includes(lower) ||
          (p.address || "").toLowerCase().includes(lower),
      );
    }

    return filtered;
  }, [properties, propertySearch, selectedLandlordId]);

  const selectedLandlord = useMemo(() => {
    if (!selectedLandlordId) return null;
    return landlords.find((l) => l.id === Number(selectedLandlordId)) || null;
  }, [landlords, selectedLandlordId]);

  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p) => p.id === Number(selectedPropertyId)) || null;
  }, [properties, selectedPropertyId]);

  const onSelectLandlord = useCallback((landlord) => {
    setSelectedLandlordId(String(landlord.id));
    setLandlordSearch(landlord.full_name || "");
    setShowLandlordDropdown(false);
  }, []);

  const onClearLandlord = useCallback(() => {
    setSelectedLandlordId("");
    setLandlordSearch("");
  }, []);

  const onSelectProperty = useCallback((prop) => {
    setSelectedPropertyId(String(prop.id));
    setPropertySearch(prop.property_name || "");
    setShowPropertyDropdown(false);
  }, []);

  const onClearProperty = useCallback(() => {
    setSelectedPropertyId("");
    setPropertySearch("");
  }, []);

  // Fetch all tenants report
  const tenantsQuery = useQuery({
    queryKey: [
      "reports",
      "all-tenants",
      selectedLandlordId,
      selectedPropertyId,
      fromDate,
      toDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedLandlordId) params.set("landlordId", selectedLandlordId);
      if (selectedPropertyId) params.set("propertyId", selectedPropertyId);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      return await fetchJson(`/api/reports/all-tenants?${params.toString()}`);
    },
    enabled: !userLoading && !!user && canViewReports,
  });

  const tenants = tenantsQuery.data?.tenants || [];

  // PDF Generation
  const openPrintView = useCallback(
    (autoPrint) => {
      if (typeof window === "undefined") return;

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

      const now = new Date();
      const generatedAt = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const landlordText = selectedLandlord
        ? selectedLandlord.full_name
        : "All Landlords";
      const propertyText = selectedProperty
        ? selectedProperty.property_name
        : "All Properties";

      // Build table rows
      let tableRows = "";

      tenants.forEach((t) => {
        tableRows += `<tr>
          <td>${escapeHtml(t.unit_number || "—")}</td>
          <td>${escapeHtml(t.property_name || "—")}</td>
          <td>${escapeHtml(t.tenant_name || "—")}</td>
          <td>${escapeHtml(t.phone || "—")}</td>
          <td class="right">${fmtMoney(t.monthly_rent)}</td>
          <td></td>
        </tr>`;
      });

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>All Tenants Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0.75in 0.6in;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Header */
    .report-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #334155;
    }
    .report-header h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .report-header .meta {
      font-size: 11px;
      color: #475569;
      margin-bottom: 3px;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-top: 12px;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 8px 8px;
      border-bottom: 2px solid #334155;
      text-align: left;
    }
    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      vertical-align: middle;
    }
    .right { text-align: right; }

    /* Footer */
    .report-footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
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
    <h1>All Tenants Report</h1>
    <div class="meta">Landlord: ${escapeHtml(landlordText)}</div>
    <div class="meta">Property: ${escapeHtml(propertyText)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Unit No.</th>
        <th>Property</th>
        <th>Name</th>
        <th>Phone</th>
        <th class="right">Rent</th>
        <th>TID</th>
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

      if (autoPrint) {
        w.focus();
        setTimeout(() => {
          try {
            w.print();
          } catch (e) {
            console.error("Print failed", e);
          }
        }, 400);
      }
    },
    [tenants, selectedLandlord, selectedProperty],
  );

  const landlordDropdownVisible =
    showLandlordDropdown && filteredLandlords.length > 0;
  const propertyDropdownVisible =
    showPropertyDropdown && filteredProperties.length > 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">All Tenants</h2>
        <p className="text-slate-500">
          Complete list of all active tenants with filters
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Landlord Search */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600">Landlord</div>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={landlordSearch}
                  onChange={(e) => {
                    setLandlordSearch(e.target.value);
                    setShowLandlordDropdown(true);
                    if (!e.target.value.trim()) setSelectedLandlordId("");
                  }}
                  onFocus={() => setShowLandlordDropdown(true)}
                  placeholder="All Landlords"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-sky-500 text-sm"
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
                    const isSelected = l.id === Number(selectedLandlordId);
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
                        {l.phone && (
                          <div className="text-xs text-slate-500">
                            {l.phone}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Property Search */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600">Property</div>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={propertySearch}
                  onChange={(e) => {
                    setPropertySearch(e.target.value);
                    setShowPropertyDropdown(true);
                    if (!e.target.value.trim()) setSelectedPropertyId("");
                  }}
                  onFocus={() => setShowPropertyDropdown(true)}
                  placeholder="All Properties"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-sky-500 text-sm"
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

              {propertyDropdownVisible && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredProperties.map((p) => {
                    const isSelected = p.id === Number(selectedPropertyId);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectProperty(p)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                          isSelected ? "bg-sky-50 font-medium" : ""
                        }`}
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

          {/* From Date */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600">From Date</div>
            <DatePopoverInput
              value={fromDate}
              onChange={setFromDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600">To Date</div>
            <DatePopoverInput
              value={toDate}
              onChange={setToDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Close dropdowns on outside click */}
      {landlordDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowLandlordDropdown(false)}
        />
      )}
      {propertyDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowPropertyDropdown(false)}
        />
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => openPrintView(false)}
          disabled={tenants.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          type="button"
          onClick={() => openPrintView(true)}
          disabled={tenants.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          Generate PDF
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {tenantsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading tenants…</p>
        ) : tenantsQuery.error ? (
          <p className="text-sm text-rose-600">Could not load tenants.</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-slate-500">
            No tenants found with the current filters.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                  <th className="py-2 px-3">Unit No.</th>
                  <th className="py-2 px-3">Property</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3 text-right">Rent</th>
                  <th className="py-2 px-3">TID</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, idx) => (
                  <tr
                    key={idx}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-2 px-3">{t.unit_number || "—"}</td>
                    <td className="py-2 px-3">{t.property_name || "—"}</td>
                    <td className="py-2 px-3">{t.tenant_name || "—"}</td>
                    <td className="py-2 px-3">{t.phone || "—"}</td>
                    <td className="py-2 px-3 text-right">
                      {formatCurrencyUGX(t.monthly_rent)}
                    </td>
                    <td className="py-2 px-3"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
