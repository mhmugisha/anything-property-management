"use client";

import { useState } from "react";
import { ArrowLeft, CalendarClock } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import { useDuePromises } from "@/hooks/usePaymentPromises";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import DashboardSidebar from "@/components/Shell/DashboardSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";

function formatShortDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return s;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysDiffFromToday(iso) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return null;
  const target = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - target.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export default function PromisesDuePage() {
  const { data: user, loading: userLoading } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const staffQuery = useStaffProfile(!userLoading && !!user);
  const canManageTenants = staffQuery.data?.permissions?.tenants === true;

  const dueQuery = useDuePromises(
    !userLoading && !!user && canManageTenants,
  );
  const rows = dueQuery.data?.promises || [];
  const count = Number(dueQuery.data?.count || 0);

  if (userLoading || (user && staffQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/account/signin";
    }
    return null;
  }

  if (!staffQuery.data) {
    if (typeof window !== "undefined") {
      window.location.href = "/onboarding";
    }
    return null;
  }

  if (!canManageTenants) {
    return (
      <AccessDenied
        title="Promises Due"
        message="You don't have access to view payment promises."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Promises Due"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="dashboard"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="dashboard"
      />
      <Sidebar active="dashboard">
        <DashboardSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-6 h-6 text-slate-700" />
                Promises Due
              </h1>
              <p className="text-slate-500">
                Tenants whose latest payment promise is due today or overdue.
              </p>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </a>
          </div>

          {/* Summary chip */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
                Total Due
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {count}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            {dueQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading promises…</p>
            ) : dueQuery.error ? (
              <p className="text-sm text-rose-600">
                {dueQuery.error.message || "Could not load promises."}
              </p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">
                No due or overdue promises.
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                      <th className="py-2 px-3">Tenant</th>
                      <th className="py-2 px-3">Property / Unit</th>
                      <th className="py-2 px-3">Promise Date</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3">Comment</th>
                      <th className="py-2 px-3 text-right">Current Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const daysLate = daysDiffFromToday(r.promise_date);
                      const isOverdue = daysLate != null && daysLate > 0;
                      const badgeText =
                        daysLate === 0
                          ? "Due today"
                          : isOverdue
                            ? `${daysLate}d overdue`
                            : "";
                      const badgeClass = isOverdue
                        ? "text-rose-700 bg-rose-50 border-rose-200"
                        : "text-amber-700 bg-amber-50 border-amber-200";
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-2 px-3 text-slate-800 font-medium align-top">
                            <div>{r.tenant_name}</div>
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                              {r.tenant_phone || "—"}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-700 align-top">
                            <div>{r.property_name || "—"}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {r.unit_number ? `Unit ${r.unit_number}` : "—"}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <div>{formatShortDate(r.promise_date)}</div>
                            {badgeText ? (
                              <span
                                className={`inline-block mt-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${badgeClass}`}
                              >
                                {badgeText}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900 font-medium">
                            {r.amount != null ? formatCurrencyUGX(r.amount) : "—"}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {r.comment || "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900 font-medium">
                            {formatCurrencyUGX(r.current_balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
