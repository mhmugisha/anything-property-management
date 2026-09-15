import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { useManagerArrearsReport } from "@/hooks/useReports";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

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
  return new Date().getMonth() + 1;
}

function getDefaultYear() {
  return new Date().getFullYear();
}

function buildYearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current + 1; y >= 2020; y--) years.push(y);
  return years;
}

export function ManagerArrearsReport({ userLoading, user, canViewReports }) {
  const printRef = useRef(null);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [selectedYear, setSelectedYear] = useState(getDefaultYear);
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
    {
      month: selectedMonth,
      year: selectedYear,
      officerId: selectedOfficerId,
    },
    !userLoading && !!user && canViewReports,
  );

  const data = reportQuery.data;
  const managers = data?.managers || [];
  const grandTotal = Number(data?.grand_total_arrears || 0);
  const grandTenants = Number(data?.grand_total_tenants_count || 0);

  const selectedMonthLabel = MONTH_NAMES[selectedMonth - 1] || "";
  const reportTitle = `Manager Arrears – ${selectedMonthLabel} ${selectedYear}`;

  const officerLabel = useMemo(() => {
    if (!selectedOfficerId) return "All Managers";
    if (selectedOfficerId === "unassigned") return "Unassigned";
    const found = officers.find((o) => String(o.id) === String(selectedOfficerId));
    return found ? found.full_name : "—";
  }, [selectedOfficerId, officers]);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  return (
    <div ref={printRef}>
      {/* Printable header */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 text-center">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
          {reportTitle}
        </h1>
        <div className="mt-2 flex flex-col items-center gap-1 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Portfolio Manager:</span>{" "}
            {officerLabel}
          </div>
          {data?.as_of?.as_of_date && (
            <div className="text-xs text-slate-500">
              As of end of month ({data.as_of.as_of_date})
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        data-no-print="true"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
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

      {/* Grand total summary */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
              Grand Total Arrears
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrencyUGX(grandTotal)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
              Tenants in Arrears
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {grandTenants}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {reportQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading report…</p>
        ) : reportQuery.error ? (
          <p className="text-sm text-rose-600">
            {reportQuery.error.message || "Could not load report."}
          </p>
        ) : managers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No arrears found for {selectedMonthLabel} {selectedYear}.
          </p>
        ) : (
          <div className="space-y-6">
            {managers.map((m) => (
              <ManagerBlock key={m.officer_id === null ? "unassigned" : m.officer_id} manager={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerBlock({ manager }) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b-2 border-slate-800 pb-2 mb-3">
        <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
          {manager.officer_name}
        </h3>
        <div className="text-sm text-slate-700">
          <span className="mr-4">
            {manager.total_tenants_count}{" "}
            {manager.total_tenants_count === 1 ? "tenant" : "tenants"}
          </span>
          <span className="font-bold text-slate-900">
            {formatCurrencyUGX(manager.total_arrears)}
          </span>
        </div>
      </div>

      <div className="space-y-4 pl-2">
        {manager.properties.map((p) => (
          <PropertyBlock
            key={p.property_id === null ? "none" : p.property_id}
            property={p}
          />
        ))}
      </div>
    </section>
  );
}

function PropertyBlock({ property }) {
  return (
    <div>
      <div className="flex items-baseline justify-between bg-slate-50 rounded-lg px-3 py-2 mb-1">
        <div className="font-semibold text-slate-800">{property.property_name}</div>
        <div className="text-sm text-slate-700">
          <span className="mr-3 text-slate-500">
            {property.subtotal_tenants_count}{" "}
            {property.subtotal_tenants_count === 1 ? "tenant" : "tenants"}
          </span>
          <span className="font-semibold text-slate-900">
            {formatCurrencyUGX(property.subtotal_arrears)}
          </span>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-300">
              <th className="py-1.5 pr-3 font-medium">Tenant</th>
              <th className="py-1.5 pr-3 font-medium">Unit</th>
              <th className="py-1.5 pr-3 font-medium text-right">Months</th>
              <th className="py-1.5 pr-3 font-medium text-right">Days</th>
              <th className="py-1.5 pr-3 font-medium">Bucket</th>
              <th className="py-1.5 pr-3 font-medium text-right">Arrears</th>
            </tr>
          </thead>
          <tbody>
            {property.tenants.map((t) => (
              <tr
                key={t.lease_id}
                className="border-b last:border-b-0 border-slate-100"
              >
                <td className="py-1.5 pr-3 text-slate-800">{t.tenant_name}</td>
                <td className="py-1.5 pr-3 text-slate-700">{t.unit_number}</td>
                <td className="py-1.5 pr-3 text-right text-slate-700">
                  {t.months_behind}
                </td>
                <td className="py-1.5 pr-3 text-right text-slate-700">
                  {t.days_overdue}
                </td>
                <td className="py-1.5 pr-3 text-slate-700">{t.bucket}</td>
                <td className="py-1.5 pr-3 text-right font-medium text-slate-900">
                  {formatCurrencyUGX(t.arrears_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
