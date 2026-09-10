"use client";

import { useState } from "react";
import { useEmployeeStatement } from "@/hooks/usePayroll";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-UG", { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EmployeeStatement({ employeeId }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const [fetchDates, setFetchDates] = useState({ from: yearStart, to: today });

  const stmtQuery = useEmployeeStatement(employeeId, fetchDates.from, fetchDates.to);
  const data = stmtQuery.data || null;

  const handleFetch = () => setFetchDates({ from: fromDate, to: toDate });

  const exportCsv = () => {
    if (!data?.rows?.length) return;
    const header = "Date,Description,Debit (UGX),Credit (UGX),Balance (UGX)";
    const lines = data.rows.map((r) =>
      [r.date, `"${r.description}"`, r.debit, r.credit, r.balance].join(","),
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${employeeId}-${fetchDates.from}-${fetchDates.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4 no-print-wrapper">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      {/* Top bar: title left, export/print right */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Staff Statement</p>
        {data?.rows?.length > 0 && (
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-medium hover:bg-[#08172c]"
            >
              Print PDF
            </button>
          </div>
        )}
      </div>

      {/* Date range controls */}
      <div className="flex items-end gap-3 no-print">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleFetch}
          className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-medium hover:bg-[#08172c]"
        >
          Apply
        </button>
      </div>

      {stmtQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : stmtQuery.isError ? (
        <p className="text-sm text-red-500">Failed to load statement</p>
      ) : data ? (
        <>
          {/* Transaction table */}
          {data.rows.length === 0 ? (
            <p className="text-sm text-slate-400">No transactions in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs border-b-2 border-slate-300">
                    <th className="text-left py-2 px-2 font-semibold rounded-tl-md">Date</th>
                    <th className="text-left py-2 px-2 font-semibold">Description</th>
                    <th className="text-right py-2 px-2 font-semibold">Debit (UGX)</th>
                    <th className="text-right py-2 px-2 font-semibold">Credit (UGX)</th>
                    <th className="text-right py-2 px-2 font-semibold rounded-tr-md">Balance (UGX)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-1.5 text-slate-700">{r.description}</td>
                      <td className="py-1.5 text-right text-amber-700">{r.debit > 0 ? fmtNum(r.debit) : "—"}</td>
                      <td className="py-1.5 text-right text-green-700">{r.credit > 0 ? fmtNum(r.credit) : "—"}</td>
                      <td className={`py-1.5 text-right font-medium ${r.balance < 0 ? "text-red-600" : "text-slate-800"}`}>{fmtNum(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary — below the table, neutral colors */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t-2 border-slate-700">
            <div className="rounded-lg p-3 border border-gray-200 bg-white">
              <p className="text-xs text-slate-500 font-medium">Total Credited (UGX)</p>
              <p className="text-base font-bold text-slate-800 mt-0.5">{fmtNum(data.total_credited)}</p>
            </div>
            <div className="rounded-lg p-3 border border-gray-200 bg-white">
              <p className="text-xs text-slate-500 font-medium">Total Debited (UGX)</p>
              <p className="text-base font-bold text-slate-800 mt-0.5">{fmtNum(data.total_debited)}</p>
            </div>
            <div className="rounded-lg p-3 border border-gray-200 bg-white">
              <p className="text-xs text-slate-500 font-medium">Closing Balance (UGX)</p>
              <p className={`text-base font-bold mt-0.5 ${data.closing_balance < 0 ? "text-red-600" : "text-slate-800"}`}>{fmtNum(data.closing_balance)}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
