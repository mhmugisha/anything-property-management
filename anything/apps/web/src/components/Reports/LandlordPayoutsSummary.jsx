"use client";

import { useRef, useState } from "react";
import { useLandlordPayoutsSummary } from "@/hooks/useReports";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { Field } from "@/components/Reports/Field";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

export function LandlordPayoutsSummary({ userLoading, user, canViewReports }) {
  const printRef = useRef(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const enabled = !userLoading && !!user && canViewReports;
  const payoutsQuery = useLandlordPayoutsSummary({ from, to }, enabled);

  const rows = payoutsQuery.data?.rows || [];
  const totals = payoutsQuery.data?.totals || {
    total_paid: 0,
    payout_count: 0,
  };

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Landlord payouts summary (info)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Shows how much has been paid out to landlords. This is just for
            reference.
          </p>
        </div>

        <div className="sm:ml-auto" data-no-print="true">
          <PrintPreviewButtons
            targetRef={printRef}
            title="Landlord payouts summary"
          />
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        data-no-print="true"
      >
        <Field label="From (optional)">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>
        <Field label="To (optional)">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>
      </div>

      {payoutsQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : payoutsQuery.error ? (
        <p className="mt-4 text-sm text-rose-600">
          Could not load landlord payouts summary.
        </p>
      ) : (
        <div className="mt-4 overflow-auto">
          <table className="w-full text-sm border-b-2 border-slate-700">
            <thead>
              <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                <th className="py-2 pr-3">Landlord</th>
                <th className="py-2 pr-3 text-right">Payouts</th>
                <th className="py-2 pr-3 text-right">Total paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.landlord_id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3 font-medium text-slate-800">
                    {r.landlord_name}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {Number(r.payout_count || 0)}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                    {formatCurrencyUGX(r.total_paid)}
                  </td>
                </tr>
              ))}

              <tr className="border-t-2 border-slate-700">
                <td className="py-2 pr-3 font-semibold text-slate-900">
                  Total
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                  {Number(totals.payout_count || 0)}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                  {formatCurrencyUGX(totals.total_paid)}
                </td>
              </tr>
            </tbody>
          </table>

          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No payouts found.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
