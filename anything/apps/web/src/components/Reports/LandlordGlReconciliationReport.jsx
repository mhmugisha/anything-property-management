import { RotateCw } from "lucide-react";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { useLandlordGlReconciliation } from "@/hooks/useLandlordGlReconciliation";

// A gap below one shilling is rounding, not a difference worth chasing.
const MATERIAL_GAP = 1;

function TotalCard({ label, value, alert }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-lg font-semibold ${alert ? "text-red-700" : "text-[#0B1F3A]"}`}
      >
        {formatCurrencyUGX(value)}
      </div>
    </div>
  );
}

// Read-only: GL account 2100 against the trusted source figure, per landlord.
export function LandlordGlReconciliationReport({ enabled }) {
  const reportQuery = useLandlordGlReconciliation(enabled);
  const data = reportQuery.data || {};
  const landlords = data.landlords || [];
  const totals = data.totals || { gl_2100: 0, source_due: 0, gap: 0 };
  const unattributable = data.unattributable || {
    gl_2100: 0,
    count: 0,
    by_source_type: [],
  };
  const updatedAt = reportQuery.dataUpdatedAt
    ? new Date(reportQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              GL 2100 vs Source – Landlord Reconciliation
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All-time. Basis: {data.basis || "—"}. Positive gap = GL above
              source.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reportQuery.refetch()}
            disabled={reportQuery.isFetching}
            title={updatedAt ? `Updated ${updatedAt}` : "Refresh"}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400 disabled:opacity-50"
          >
            <RotateCw
              className={`w-4 h-4 ${reportQuery.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TotalCard label="GL 2100 (ledger)" value={totals.gl_2100} />
          <TotalCard
            label="Source (due to landlords)"
            value={totals.source_due}
          />
          <TotalCard
            label="Gap (GL − source)"
            value={totals.gap}
            alert={Math.abs(Number(totals.gap || 0)) >= 0.005}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        {reportQuery.isLoading ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Loading reconciliation…
          </div>
        ) : reportQuery.isError ? (
          <div className="text-sm text-red-600">
            {reportQuery.error?.message || "Failed to load the reconciliation."}
          </div>
        ) : landlords.length === 0 ? (
          <div className="text-sm text-slate-500">No landlords to show.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">GL 2100</th>
                  <th className="py-2 pr-3 text-right">Source due</th>
                  <th className="py-2 pr-3 text-right">Gap</th>
                  <th className="py-2 pr-3 text-right text-xs font-normal">
                    No-property GL
                  </th>
                  <th className="py-2 pr-3 text-right text-xs font-normal">
                    Pending GL
                  </th>
                  <th className="py-2 pr-3 text-right text-xs font-normal">
                    Mismatch
                  </th>
                </tr>
              </thead>
              <tbody>
                {landlords.map((l) => {
                  const material = Math.abs(Number(l.gap || 0)) >= MATERIAL_GAP;
                  return (
                    <tr
                      key={l.landlord_id}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-2 pr-3 text-slate-800">
                        {l.name || `Landlord #${l.landlord_id}`}
                      </td>
                      <td className="py-2 pr-3 text-slate-600 capitalize">
                        {l.status || "—"}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {formatCurrencyUGX(l.gl_2100)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {formatCurrencyUGX(l.source_due)}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right whitespace-nowrap font-medium ${
                          material ? "bg-red-50 text-red-700" : "text-slate-800"
                        }`}
                      >
                        {formatCurrencyUGX(l.gap)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-xs text-slate-500">
                        {formatCurrencyUGX(l.no_property_gl)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-xs text-slate-500">
                        {formatCurrencyUGX(l.pending_gl)}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap text-xs text-slate-500">
                        {l.mismatch_count || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!reportQuery.isLoading && !reportQuery.isError && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">
              Unattributable
            </div>
            <div className="text-sm text-slate-700">
              {`${formatCurrencyUGX(unattributable.gl_2100)} · ${unattributable.count} row${
                unattributable.count === 1 ? "" : "s"
              }`}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            2100 postings with no landlord and no property. Part of the total
            gap, but not of any landlord row.
          </p>
          {(unattributable.by_source_type || []).length === 0 ? (
            <div className="text-sm text-slate-500 mt-2">None.</div>
          ) : (
            <ul className="mt-2 text-sm divide-y divide-gray-50">
              {unattributable.by_source_type.map((s) => (
                <li
                  key={s.source_type}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-slate-700">{s.source_type}</span>
                  <span className="text-slate-500 whitespace-nowrap">
                    {`${formatCurrencyUGX(s.amount)} · ${s.count}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
