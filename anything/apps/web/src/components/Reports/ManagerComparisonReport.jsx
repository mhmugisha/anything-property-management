import { useMemo, useRef, useState } from "react";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import DatePopoverInput from "@/components/DatePopoverInput";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";
import { useManagerComparisonReport } from "@/hooks/useReports";

const numberFormatter = new Intl.NumberFormat("en-US");
const fmtNum = (n) => numberFormatter.format(Number(n || 0));

function fmtPercent(n) {
  const v = Number(n || 0);
  return `${v.toFixed(1)}%`;
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}-${m}-${y}`;
}

function rateClass(rate) {
  const v = Number(rate || 0);
  if (v >= 80) return "text-emerald-700";
  if (v < 50) return "text-rose-600";
  return "text-slate-800";
}

export function ManagerComparisonReport({ userLoading, user, canViewReports }) {
  const printRef = useRef(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const reportQuery = useManagerComparisonReport(
    { fromDate, toDate },
    !userLoading && !!user && canViewReports,
  );

  const data = reportQuery.data;
  const managers = data?.managers || [];
  const totals = data?.totals || {
    total_rent: 0,
    recovered: 0,
    balance: 0,
    recovery_rate: 0,
  };

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) {
      return `${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}`;
    }
    if (fromDate) return `From ${formatDateDisplay(fromDate)}`;
    if (toDate) return `Until ${formatDateDisplay(toDate)}`;
    return "All Dates";
  }, [fromDate, toDate]);

  const reportTitle = "Manager Comparison";

  return (
    <div ref={printRef}>
      {/* Report header */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 text-center">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
          {reportTitle}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Collection performance — of rent billed in the period, how much has been collected.
        </p>
        <div className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Date Range:</span>{" "}
          {dateRangeLabel}
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        data-no-print="true"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex flex-wrap gap-2 mb-4 justify-end"
        data-no-print="true"
      >
        <PrintPreviewButtons targetRef={printRef} title={reportTitle} />
      </div>

      {/* Main table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {reportQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading report…</p>
        ) : reportQuery.error ? (
          <p className="text-sm text-rose-600">
            {reportQuery.error.message || "Could not load report."}
          </p>
        ) : managers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No arrears data for the selected range.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                  <th className="py-2 px-3">Manager</th>
                  <th className="py-2 px-3 text-right">Properties</th>
                  <th className="py-2 px-3 text-right">Tenants</th>
                  <th className="py-2 px-3 text-right">Total Rent</th>
                  <th className="py-2 px-3 text-right">Recovered</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3 text-right">Recovery Rate</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr
                    key={m.officer_id === null ? "unassigned" : m.officer_id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {m.officer_name}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      {fmtNum(m.property_count)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      {fmtNum(m.tenant_count)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      {formatCurrencyUGX(m.total_rent)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      {formatCurrencyUGX(m.recovered)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-900">
                      {formatCurrencyUGX(m.balance)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${rateClass(m.recovery_rate)}`}
                    >
                      {fmtPercent(m.recovery_rate)}
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                <tr className="border-t-2 border-b-2 border-slate-700 bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">TOTALS</td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrencyUGX(totals.total_rent)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrencyUGX(totals.recovered)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrencyUGX(totals.balance)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${rateClass(totals.recovery_rate)}`}
                  >
                    {fmtPercent(totals.recovery_rate)}
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
