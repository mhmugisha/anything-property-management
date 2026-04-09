import { useMemo, useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { SummaryCard } from "./SummaryCard";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { downloadCsv } from "@/utils/downloadCsv";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

export function ArrearsReport({ arrearsQuery }) {
  const printRef = useRef(null);
  const arrearsRows = arrearsQuery.data || [];

  const arrearsTotals = useMemo(() => {
    return arrearsRows.reduce(
      (acc, r) => {
        acc.total += Number(r.arrears_amount || 0);
        if (r.bucket === "30") acc.bucket30 += Number(r.arrears_amount || 0);
        if (r.bucket === "60") acc.bucket60 += Number(r.arrears_amount || 0);
        if (r.bucket === "90+") acc.bucket90 += Number(r.arrears_amount || 0);
        return acc;
      },
      { total: 0, bucket30: 0, bucket60: 0, bucket90: 0 },
    );
  }, [arrearsRows]);

  const onExportArrears = useCallback(() => {
    const filename = `arrears-report-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, arrearsRows);
  }, [arrearsRows]);

  const errorMessage = arrearsQuery.error
    ? arrearsQuery.error.message || "Could not load arrears report."
    : null;

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Arrears aging
          </h2>
          <p className="text-sm text-slate-500">
            Based on unpaid invoices (real outstanding balances)
          </p>
        </div>
        <div className="flex gap-2 sm:ml-auto" data-no-print="true">
          <button
            onClick={onExportArrears}
            disabled={arrearsRows.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <PrintPreviewButtons targetRef={printRef} title="Arrears aging" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard
          label="Total"
          value={formatCurrencyUGX(arrearsTotals.total)}
        />
        <SummaryCard
          label="30+ days"
          value={formatCurrencyUGX(arrearsTotals.bucket30)}
        />
        <SummaryCard
          label="60+ days"
          value={formatCurrencyUGX(arrearsTotals.bucket60)}
        />
        <SummaryCard
          label="90+ days"
          value={formatCurrencyUGX(arrearsTotals.bucket90)}
        />
      </div>

      {arrearsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : arrearsQuery.error ? (
        <div className="text-sm text-rose-600">
          <div>Could not load arrears report.</div>
          <div className="text-xs text-rose-500 mt-1">{errorMessage}</div>
        </div>
      ) : arrearsRows.length === 0 ? (
        <p className="text-sm text-slate-500">No arrears found.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Bold separator line between headers and first entry */}
              <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                <th className="py-2 pr-3">Tenant</th>
                <th className="py-2 pr-3">Property</th>
                <th className="py-2 pr-3">Unit</th>
                <th className="py-2 pr-3">Invoices unpaid</th>
                <th className="py-2 pr-3">Bucket</th>
                <th className="py-2 pr-3 text-right">Arrears</th>
              </tr>
            </thead>
            <tbody>
              {arrearsRows.map((r) => {
                const arrearsText = formatCurrencyUGX(r.arrears_amount);
                return (
                  <tr
                    key={r.lease_id}
                    className="border-b last:border-b-2 last:border-slate-700"
                  >
                    <td className="py-2 pr-3">{r.tenant_name}</td>
                    <td className="py-2 pr-3">{r.property_name}</td>
                    <td className="py-2 pr-3">{r.unit_number}</td>
                    <td className="py-2 pr-3">{r.months_behind}</td>
                    <td className="py-2 pr-3">{r.bucket}</td>
                    <td className="py-2 pr-3 text-right font-medium text-slate-800">
                      {arrearsText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
