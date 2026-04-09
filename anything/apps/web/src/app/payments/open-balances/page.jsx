"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Printer, Eye } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import DashboardSidebar from "@/components/Shell/DashboardSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import DatePopoverInput from "@/components/DatePopoverInput";
import InvoiceDeleteButton from "@/components/InvoiceDeleteButton";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX, formatDate } from "@/utils/formatters";

export default function OpenBalancesPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filters
  const [propertySearch, setPropertySearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const canManagePayments = staffQuery.data?.permissions?.payments === true;

  // Fetch properties for autocomplete
  const propertiesQuery = useQuery({
    queryKey: ["lookups", "properties"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/properties");
      return data.properties || [];
    },
    enabled: !userLoading && !!user && canManagePayments,
  });

  const properties = propertiesQuery.data || [];

  // Filter properties based on search
  const filteredProperties = useMemo(() => {
    if (!propertySearch.trim()) return properties;
    const lower = propertySearch.toLowerCase();
    return properties.filter(
      (p) =>
        (p.property_name || "").toLowerCase().includes(lower) ||
        (p.address || "").toLowerCase().includes(lower),
    );
  }, [properties, propertySearch]);

  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return properties.find((p) => p.id === Number(selectedPropertyId)) || null;
  }, [properties, selectedPropertyId]);

  const onSelectProperty = useCallback((prop) => {
    setSelectedPropertyId(String(prop.id));
    setPropertySearch(prop.property_name || "");
    setShowPropertyDropdown(false);
  }, []);

  const onClearProperty = useCallback(() => {
    setSelectedPropertyId("");
    setPropertySearch("");
  }, []);

  // Fetch open balances
  const openBalancesQuery = useQuery({
    queryKey: [
      "payments",
      "openBalances",
      selectedPropertyId,
      dateFilter,
      fromDate,
      toDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPropertyId) params.set("propertyId", selectedPropertyId);
      params.set("dateFilter", dateFilter);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      return await fetchJson(
        `/api/payments/open-balances?${params.toString()}`,
      );
    },
    enabled: !userLoading && !!user && canManagePayments,
  });

  const rows = openBalancesQuery.data?.rows || [];
  const total = openBalancesQuery.data?.total || 0;

  // Group by property for subtotals (when All Properties selected)
  const groupedByProperty = useMemo(() => {
    if (selectedPropertyId) return null;

    const groups = {};
    rows.forEach((r) => {
      const propId = r.property_id || "none";
      const propName = r.property_name || "Unknown Property";
      if (!groups[propId]) {
        groups[propId] = {
          propertyId: propId,
          propertyName: propName,
          rows: [],
          subtotal: 0,
        };
      }
      groups[propId].rows.push(r);
      groups[propId].subtotal += Number(r.outstanding_balance || 0);
    });

    // Sort rows within each property by unit_number (ascending)
    Object.values(groups).forEach((group) => {
      group.rows.sort((a, b) => {
        const unitA = String(a.unit_number || "");
        const unitB = String(b.unit_number || "");

        // Try numeric comparison if both are numbers
        const numA = parseInt(unitA, 10);
        const numB = parseInt(unitB, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }

        // Fallback to string comparison
        return unitA.localeCompare(unitB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    });

    return Object.values(groups).sort((a, b) =>
      a.propertyName.localeCompare(b.propertyName),
    );
  }, [rows, selectedPropertyId]);

  const isLoading = userLoading || staffQuery.isLoading;
  const showPropertyColumn = !selectedPropertyId;

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

      // Build header info
      const propertyText = selectedProperty
        ? selectedProperty.property_name
        : "All Properties";

      let dateRangeText = "";
      if (dateFilter === "overdue") {
        dateRangeText = "Overdue Only";
      } else if (dateFilter === "current") {
        dateRangeText = "Current (Not Yet Due)";
      } else if (fromDate && toDate) {
        dateRangeText = `${formatDate(fromDate)} to ${formatDate(toDate)}`;
      } else if (fromDate) {
        dateRangeText = `From ${formatDate(fromDate)}`;
      } else if (toDate) {
        dateRangeText = `Until ${formatDate(toDate)}`;
      } else {
        dateRangeText = "All Open Balances";
      }

      // Build table rows
      let tableRows = "";

      if (showPropertyColumn && groupedByProperty) {
        // Group by property with subtotals
        groupedByProperty.forEach((group) => {
          group.rows.forEach((r) => {
            tableRows += `<tr>
            <td>${escapeHtml(r.unit_number || "—")}</td>
            <td>${escapeHtml(r.tenant_name || "—")}</td>
            <td>${escapeHtml(r.tenant_phone || "—")}</td>
            <td>${escapeHtml(r.property_name || "—")}</td>
            <td class="center">${escapeHtml(formatDate(r.due_date))}</td>
            <td class="right">${fmtMoney(r.outstanding_balance)}</td>
          </tr>`;
          });
          // Subtotal row
          tableRows += `<tr style="background: #f8fafc; border-top: 1px solid #cbd5e1;">
          <td colspan="4"></td>
          <td style="font-weight: 600; padding: 8px 8px;" class="center">${escapeHtml(group.propertyName)} Subtotal</td>
          <td class="right" style="font-weight: 600; padding: 8px 8px;">${fmtMoney(group.subtotal)}</td>
        </tr>`;
        });
      } else {
        // No property column
        rows.forEach((r) => {
          tableRows += `<tr>
          <td>${escapeHtml(r.unit_number || "—")}</td>
          <td>${escapeHtml(r.tenant_name || "—")}</td>
          <td>${escapeHtml(r.tenant_phone || "—")}</td>
          <td class="center">${escapeHtml(formatDate(r.due_date))}</td>
          <td class="right">${fmtMoney(r.outstanding_balance)}</td>
        </tr>`;
        });
      }

      // Add totals row
      const totalColspan = showPropertyColumn ? "5" : "4";
      tableRows += `<tr style="border-top: 2px solid #334155; border-bottom: 2px solid #334155; background: #f8fafc;">
      <td colspan="${totalColspan}" style="font-weight: 700; padding: 10px 8px;">Total Outstanding Balance</td>
      <td class="right" style="font-weight: 700; padding: 10px 8px;">${fmtMoney(total)}</td>
    </tr>`;

      // Build table header
      const tableHeader = showPropertyColumn
        ? `<tr>
          <th>Unit No</th>
          <th>Tenant Name</th>
          <th>Phone</th>
          <th>Property</th>
          <th class="center">Due Date</th>
          <th class="right">Outstanding Amount (UGX)</th>
        </tr>`
        : `<tr>
          <th>Unit No</th>
          <th>Tenant Name</th>
          <th>Phone</th>
          <th class="center">Due Date</th>
          <th class="right">Outstanding Amount (UGX)</th>
        </tr>`;

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Open Balances Report</title>
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
    .center { text-align: center; }

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
    <h1>Open Balances Report</h1>
    <div class="meta">Property: ${escapeHtml(propertyText)}</div>
    <div class="meta">Date Range: ${escapeHtml(dateRangeText)}</div>
  </div>

  <table>
    <thead>
      ${tableHeader}
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
    [
      rows,
      total,
      selectedProperty,
      dateFilter,
      fromDate,
      toDate,
      showPropertyColumn,
      groupedByProperty,
    ],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
    return null;
  }

  if (!staffQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/onboarding";
    return null;
  }

  if (!canManagePayments) {
    return (
      <AccessDenied
        title="Open Balances"
        message="You don't have access to view open balances."
      />
    );
  }

  const dropdownVisible = showPropertyDropdown && filteredProperties.length > 0;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Dashboard"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="dashboard"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="dashboard"
      />
      <Sidebar active="dashboard">
        <DashboardSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-800">
              Open Balances
            </h1>
            <p className="text-slate-500">
              All tenant balances that are not fully settled
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Property Search */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">
                  Property
                </div>
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

                  {dropdownVisible && (
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

              {/* Date Filter Type */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">Status</div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
                >
                  <option value="all">All Open</option>
                  <option value="overdue">Overdue Only</option>
                  <option value="current">Current (Not Yet Due)</option>
                </select>
              </div>

              {/* From Date */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">
                  From Date
                </div>
                <DatePopoverInput
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="DD-MM-YYYY"
                  className="bg-gray-50"
                />
              </div>

              {/* To Date */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">
                  To Date
                </div>
                <DatePopoverInput
                  value={toDate}
                  onChange={setToDate}
                  placeholder="DD-MM-YYYY"
                  className="bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Close dropdown on outside click */}
          {dropdownVisible && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPropertyDropdown(false)}
            />
          )}

          {/* Action Buttons - Moved to the right */}
          <div className="flex justify-end gap-2 mb-4">
            <button
              type="button"
              onClick={() => openPrintView(false)}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => openPrintView(true)}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Generate PDF
            </button>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            {openBalancesQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading open balances…</p>
            ) : openBalancesQuery.error ? (
              <p className="text-sm text-rose-600">
                Could not load open balances.
              </p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">
                No open balances found with the current filters.
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                      <th className="py-2 px-3">Unit No</th>
                      <th className="py-2 px-3">Tenant Name</th>
                      <th className="py-2 px-3">Phone</th>
                      {showPropertyColumn && (
                        <th className="py-2 px-3">Property</th>
                      )}
                      <th className="py-2 px-3 text-center">Due Date</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-right">
                        Outstanding Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {showPropertyColumn && groupedByProperty ? (
                      // Grouped view with property subtotals
                      <>
                        {groupedByProperty.map((group) => (
                          // eslint-disable-next-line react/jsx-key
                          <>
                            {group.rows.map((r) => {
                              const isOverdue = r.status === "overdue";
                              const statusClass = isOverdue
                                ? "text-rose-600 font-semibold"
                                : "text-emerald-600";
                              const balanceClass = isOverdue
                                ? "text-rose-600 font-semibold"
                                : "";

                              return (
                                <tr
                                  key={r.invoice_id}
                                  className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
                                  onClick={() => {
                                    if (r.tenant_id) {
                                      window.location.href = `/tenants?tenant=${r.tenant_id}`;
                                    }
                                  }}
                                >
                                  <td className="py-2 px-3">
                                    {r.unit_number || "—"}
                                  </td>
                                  <td className="py-2 px-3">
                                    {r.tenant_name || "—"}
                                  </td>
                                  <td className="py-2 px-3">
                                    {r.tenant_phone || "—"}
                                  </td>
                                  <td className="py-2 px-3">
                                    {r.property_name || "—"}
                                  </td>
                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    {formatDate(r.due_date)}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-center ${statusClass}`}
                                  >
                                    {isOverdue ? "Overdue" : "Current"}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-medium ${balanceClass}`}
                                  >
                                    {formatCurrencyUGX(r.outstanding_balance)}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Property Subtotal Row */}
                            <tr
                              key={`subtotal-${group.propertyId}`}
                              className="bg-slate-50 border-t border-slate-300"
                            >
                              <td
                                className="py-2 px-3 font-semibold text-slate-700"
                                colSpan="3"
                              ></td>
                              <td className="py-2 px-3 font-semibold text-slate-700">
                                {group.propertyName} Subtotal
                              </td>
                              <td className="py-2 px-3" colSpan="2"></td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                {formatCurrencyUGX(group.subtotal)}
                              </td>
                            </tr>
                          </>
                        ))}
                      </>
                    ) : (
                      // Simple view (single property selected)
                      rows.map((r) => {
                        const isOverdue = r.status === "overdue";
                        const statusClass = isOverdue
                          ? "text-rose-600 font-semibold"
                          : "text-emerald-600";
                        const balanceClass = isOverdue
                          ? "text-rose-600 font-semibold"
                          : "";

                        return (
                          <tr
                            key={r.invoice_id}
                            className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
                            onClick={() => {
                              if (r.tenant_id) {
                                window.location.href = `/tenants?tenant=${r.tenant_id}`;
                              }
                            }}
                          >
                            <td className="py-2 px-3">
                              {r.unit_number || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.tenant_name || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {r.tenant_phone || "—"}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {formatDate(r.due_date)}
                            </td>
                            <td
                              className={`py-2 px-3 text-center ${statusClass}`}
                            >
                              {isOverdue ? "Overdue" : "Current"}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-medium ${balanceClass}`}
                            >
                              {formatCurrencyUGX(r.outstanding_balance)}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Total Outstanding Balance Row */}
                    <tr className="border-t-2 border-b-2 border-slate-700 bg-slate-50">
                      <td
                        className="py-3 px-3 font-bold text-slate-900"
                        colSpan={showPropertyColumn ? "6" : "5"}
                      >
                        Total Outstanding Balance
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrencyUGX(total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
