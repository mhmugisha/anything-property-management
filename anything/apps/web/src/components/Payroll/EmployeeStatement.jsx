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
    <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4 no-print-wrapper">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Staff Statement</p>

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
        {data?.rows?.length > 0 && (
          <>
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50"
            >
              Print
            </button>
          </>
        )}
      </div>

      {stmtQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : stmtQuery.isError ? (
        <p className="text-sm text-red-500">Failed to load statement</p>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
              <p className="text-xs text-green-700 font-medium">Total Credited</p>
              <p className="text-base font-bold text-green-900 mt-0.5">{fmt(data.total_credited)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-amber-700 font-medium">Total Debited</p>
              <p className="text-base font-bold text-amber-900 mt-0.5">{fmt(data.total_debited)}</p>
            </div>
            <div className={`rounded-lg p-3 border ${data.closing_balance >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
              <p className={`text-xs font-medium ${data.closing_balance >= 0 ? "text-green-700" : "text-red-700"}`}>Closing Balance</p>
              <p className={`text-base font-bold mt-0.5 ${data.closing_balance >= 0 ? "text-green-900" : "text-red-700"}`}>{fmt(data.closing_balance)}</p>
            </div>
          </div>

          {/* Transaction table */}
          {data.rows.length === 0 ? (
            <p className="text-sm text-slate-400">No transactions in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-gray-200">
                    <th className="text-left py-1.5 font-medium">Date</th>
                    <th className="text-left py-1.5 font-medium">Description</th>
                    <th className="text-right py-1.5 font-medium text-amber-700">Debit</th>
                    <th className="text-right py-1.5 font-medium text-green-700">Credit</th>
                    <th className="text-right py-1.5 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-1.5 text-slate-700">{r.description}</td>
                      <td className="py-1.5 text-right text-amber-700">{r.debit > 0 ? fmt(r.debit) : "—"}</td>
                      <td className="py-1.5 text-right text-green-700">{r.credit > 0 ? fmt(r.credit) : "—"}</td>
                      <td className={`py-1.5 text-right font-medium ${r.balance < 0 ? "text-red-600" : "text-slate-800"}`}>{fmt(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
