import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import DatePopoverInput from "@/components/DatePopoverInput";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";
import { useManagerArrearsReport } from "@/hooks/useReports";

const numberFormatter = new Intl.NumberFormat("en-US");
const fmtNum = (n) => numberFormatter.format(Number(n || 0));

function fmtPercent(n) {
  const v = Number(n || 0);
  return `${v.toFixed(v >= 100 || v < 10 ? 1 : 2)}%`;
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}-${m}-${y}`;
}

export function ManagerArrearsReport({ userLoading, user, canViewReports }) {
  const printRef = useRef(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const officersQuery = useQuery({
    queryKey: ["lookups", "officers"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/officers");
      return data.officers || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });
  const officers = officersQuery.data || [];

  const reportQuery = useManagerArrearsReport(
    { fromDate, toDate, officerId: selectedOfficerId },
    !userLoading && !!user && canViewReports,
  );

  const data = reportQuery.data;
  const managers = data?.managers || [];
  const summary = data?.summary || {
    total_rent: 0,
    recovered: 0,
    balance: 0,
    recovery_rate: 0,
  };
  const grandTotal = Number(data?.grand_total_balance || 0);

  const officerLabel = useMemo(() => {
    if (!selectedOfficerId) return "All Managers";
    if (selectedOfficerId === "unassigned") return "Unassigned";
    const found = officers.find(
      (o) => String(o.id) === String(selectedOfficerId),
    );
    return found ? found.full_name : "—";
  }, [selectedOfficerId, officers]);

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) {
      return `${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}`;
    }
    if (fromDate) return `From ${formatDateDisplay(fromDate)}`;
    if (toDate) return `Until ${formatDateDisplay(toDate)}`;
    return "All Dates";
  }, [fromDate, toDate]);

  const reportTitle = "Manager Arrears";
  const hasRows = managers.some((m) =>
    m.properties.some((p) => p.rows.length > 0),
  );

  return (
    <div ref={printRef}>
      {/* Report header */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 text-center">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
          {reportTitle}
        </h1>
        <div className="mt-2 flex flex-col items-center gap-1 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Portfolio Manager:</span>{" "}
            {officerLabel}
          </div>
          <div>
            <span className="font-medium text-slate-700">Date Range:</span>{" "}
            {dateRangeLabel}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        data-no-print="true"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              From Date
            </label>
            <DatePopoverInput
              value={fromDate}
              onChange={setFromDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              To Date
            </label>
            <DatePopoverInput
              value={toDate}
              onChange={setToDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Portfolio Manager
            </label>
            <select
              value={selectedOfficerId}
              onChange={(e) => setSelectedOfficerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            >
              <option value="">All Managers</option>
              <option value="unassigned">Unassigned</option>
              {officers.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.full_name}
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
        <PrintPreviewButtons targetRef={printRef} title={reportTitle} />
      </div>

      {/* Summary boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryBox label="Total Rent" value={formatCurrencyUGX(summary.total_rent)} />
        <SummaryBox label="Recovered" value={formatCurrencyUGX(summary.recovered)} />
        <SummaryBox label="Balance" value={formatCurrencyUGX(summary.balance)} />
        <SummaryBox label="Recovery Rate" value={fmtPercent(summary.recovery_rate)} />
      </div>

      {/* Main table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        {reportQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading report…</p>
        ) : reportQuery.error ? (
          <p className="text-sm text-rose-600">
            {reportQuery.error.message || "Could not load report."}
          </p>
        ) : !hasRows ? (
          <p className="text-sm text-slate-500">
            No arrears found with the current filters.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3">Tenant</th>
                  <th className="py-2 px-3 text-right">Days</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => {
                  const managerKey =
                    m.officer_id === null ? "unassigned" : m.officer_id;
                  return (
                    <Fragment key={managerKey}>
                      {/* Manager section header */}
                      <tr className="bg-slate-800 text-white">
                        <td
                          colSpan={3}
                          className="py-2 px-3 font-semibold uppercase tracking-wide text-xs"
                        >
                          {m.officer_name}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {formatCurrencyUGX(m.total_balance)}
                        </td>
                      </tr>

                      {m.properties.map((p) => {
                        const propertyKey =
                          p.property_id === null ? "none" : p.property_id;
                        return (
                          <Fragment key={`${managerKey}-${propertyKey}`}>
                            {p.rows.map((r) => (
                              <tr
                                key={r.invoice_id}
                                className="border-b border-slate-100 hover:bg-slate-50"
                              >
                                <td className="py-2 px-3 text-slate-800">
                                  {r.unit_number}
                                </td>
                                <td className="py-2 px-3 text-slate-700">
                                  {r.tenant_name}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {fmtNum(r.days_overdue)}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-slate-900">
                                  {formatCurrencyUGX(r.balance)}
                                </td>
                              </tr>
                            ))}
                            {/* Property subtotal divider */}
                            <tr className="bg-slate-50 border-t border-slate-300">
                              <td
                                colSpan={3}
                                className="py-2 px-3 font-semibold text-slate-700"
                              >
                                {p.property_name} Subtotal
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                {formatCurrencyUGX(p.subtotal_balance)}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* Grand total */}
                <tr className="border-t-2 border-b-2 border-slate-700 bg-slate-50">
                  <td
                    colSpan={3}
                    className="py-3 px-3 font-bold text-slate-900"
                  >
                    Total Balance
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrencyUGX(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
        {label}
      </div>
      <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
