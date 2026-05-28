import { useState } from "react";
import { Field } from "./Field";
import { SummaryCard } from "./SummaryCard";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { useLandlordStatementReport } from "@/hooks/useLandlordStatementReport";
import { useRef } from "react";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

export function LandlordStatementReport({
  landlordsLookup,
  userLoading,
  user,
  canViewReports,
}) {
  const printRef = useRef(null);
  const [selectedLandlordId, setSelectedLandlordId] = useState("");

  const landlordStatementQuery = useLandlordStatementReport(
    selectedLandlordId,
    !userLoading && !!user && canViewReports,
  );

  const data = landlordStatementQuery.data || null;
  const rows = data?.rows || [];
  const summary = data?.summary || null;

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Landlord statement
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            All transactions that affect the landlord balance (account 2100).
          </p>
        </div>

        <div className="sm:ml-auto" data-no-print="true">
          <PrintPreviewButtons
            targetRef={printRef}
            title="Landlord statement"
          />
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        data-no-print="true"
      >
        <Field label="Landlord">
          <select
            value={selectedLandlordId}
            onChange={(e) => setSelectedLandlordId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select landlord…</option>
            {landlordsLookup.map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!selectedLandlordId ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-slate-500">
          Pick a landlord to view their statement.
        </div>
      ) : landlordStatementQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : landlordStatementQuery.error ? (
        <p className="mt-4 text-sm text-rose-600">
          Could not load landlord statement.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              label="Total credited (rent & adjustments)"
              value={formatCurrencyUGX(summary?.credits)}
            />
            <SummaryCard
              label="Total debited (payouts & deductions)"
              value={formatCurrencyUGX(summary?.debits)}
            />
            <SummaryCard
              label="Closing balance (UGX)"
              value={formatCurrencyUGX(summary?.closing_balance)}
            />
          </div>

          {/* Statement Table */}
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">
                      Date
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">
                      Description
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">
                      Property
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-700">
                      Debit
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-700">
                      Credit
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-700">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 px-4 text-center text-slate-400"
                      >
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr
                        key={`${r.id ?? "ob"}-${idx}`}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${r.source_type === "opening_balance" ? "bg-slate-50 font-medium" : ""}`}
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                          {String(r.date || "").slice(0, 10)}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {r.description}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {r.property_name || "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {r.debit > 0 ? formatCurrencyUGX(r.debit) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {r.credit > 0 ? formatCurrencyUGX(r.credit) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {formatCurrencyUGX(r.balance)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Totals Row */}
                  {summary ? (
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                      <td className="py-3 px-4" colSpan={2}>
                        <span className="font-bold text-slate-900">TOTALS</span>
                      </td>
                      <td className="py-3 px-4" />
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrencyUGX(summary.debits)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrencyUGX(summary.credits)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-base">
                        {formatCurrencyUGX(summary.closing_balance)}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
