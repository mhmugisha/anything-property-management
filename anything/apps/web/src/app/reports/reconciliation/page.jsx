"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import ReportsSidebar from "@/components/Shell/ReportsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useReconciliationReport } from "@/hooks/useReconciliation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function ReconciliationReportPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const canViewReports = staffQuery.data?.permissions?.reports === true;

  const reportQuery = useReconciliationReport(
    month,
    year,
    !userLoading && !!user && canViewReports,
  );

  const isLoading = userLoading || staffQuery.isLoading;

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

  if (!canViewReports) {
    return (
      <AccessDenied
        title="Reconciliation Report"
        message="You don't have access to reports."
      />
    );
  }

  const data = reportQuery.data;
  const landlords = data?.landlords || [];

  const reconciledCount = landlords.filter((l) => l.is_fully_reconciled).length;
  const unreconciledCount = landlords.length - reconciledCount;

  const allRows = landlords.flatMap((l) =>
    (l.properties || []).map((p) => ({
      landlord_id: l.landlord_id,
      landlord_name: l.landlord_name,
      property_id: p.property_id,
      property_name: p.property_name,
      gl_net: p.gl_net,
      payment_note_net: p.payment_note_net,
      difference: p.difference,
      is_reconciled: p.is_reconciled,
    })),
  );

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Reconciliation Report"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="reports"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="reports"
      />
      <Sidebar active="reports">
        <ReportsSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-800 mr-auto">
              Reconciliation Report
            </h1>

            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2099}
                className="w-24 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none"
              />
            </div>
          </div>

          {reportQuery.isLoading ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500 shadow-sm">
              Loading…
            </div>
          ) : reportQuery.error ? (
            <div className="bg-white rounded-2xl p-8 text-center text-rose-600 shadow-sm">
              {reportQuery.error.message || "Failed to load report"}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Landlords</div>
                  <div className="text-2xl font-semibold text-slate-800 mt-1">
                    {landlords.length}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
                  <div className="text-xs text-emerald-600 uppercase tracking-wide">Reconciled</div>
                  <div className="text-2xl font-semibold text-emerald-700 mt-1">
                    {reconciledCount}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100">
                  <div className="text-xs text-amber-600 uppercase tracking-wide">Unreconciled</div>
                  <div className="text-2xl font-semibold text-amber-700 mt-1">
                    {unreconciledCount}
                  </div>
                </div>
              </div>

              {allRows.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-slate-500 shadow-sm">
                  No properties found for this period.
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-gray-100">
                          <th className="text-left px-4 py-3 font-medium text-slate-600">
                            Landlord
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-slate-600">
                            Property
                          </th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">
                            GL Net
                          </th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">
                            Note Net
                          </th>
                          <th className="text-right px-4 py-3 font-medium text-slate-600">
                            Difference
                          </th>
                          <th className="text-center px-4 py-3 font-medium text-slate-600">
                            Status
                          </th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {allRows.map((row) => (
                          <tr
                            key={`${row.landlord_id}-${row.property_id}`}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-800">
                              <a
                                href="/landlords"
                                className="hover:underline text-sky-700"
                              >
                                {row.landlord_name}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.property_name}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                              {fmt(row.gl_net)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                              {fmt(row.payment_note_net)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span
                                className={
                                  row.is_reconciled
                                    ? "text-emerald-600"
                                    : "text-amber-600 font-medium"
                                }
                              >
                                {fmt(row.difference)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.is_reconciled ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Reconciled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Unreconciled
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!row.is_reconciled ? (
                                <a
                                  href="/landlords"
                                  className="text-xs text-amber-600 hover:underline"
                                >
                                  Reconcile
                                </a>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
