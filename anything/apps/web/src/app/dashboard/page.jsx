"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import {
  Wallet,
  Landmark,
  PlusSquare,
  UserPlus,
  PiggyBank,
  Receipt,
  FileText,
  X,
} from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useDashboardUndepositedFundsLines } from "@/hooks/useDashboardUndepositedFundsLines";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import DashboardSidebar from "@/components/Shell/DashboardSidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import QuickLinkTile from "@/components/QuickLinkTile";

// OPTIMIZATION: Lazy load charts to reduce initial bundle size
const DashboardCharts = lazy(
  () => import("@/components/Dashboard/DashboardCharts"),
);

export default function Dashboard() {
  const { data: user, loading: userLoading } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [undepositedOpen, setUndepositedOpen] = useState(false);

  const queriesEnabled = !userLoading && !!user;
  const staffProfileQuery = useStaffProfile(queriesEnabled);

  const statsEnabled =
    queriesEnabled && staffProfileQuery.isSuccess && !!staffProfileQuery.data;
  const statsQuery = useDashboardStats(statsEnabled);
  const undepositedLinesQuery = useDashboardUndepositedFundsLines(
    statsEnabled && undepositedOpen,
  );

  const staffProfile = staffProfileQuery.data || null;
  const stats = statsQuery.data || null;

  const loading =
    userLoading ||
    (queriesEnabled &&
      (staffProfileQuery.isLoading || (statsEnabled && statsQuery.isLoading)));

  const statsError = statsQuery.isError
    ? (() => {
        const errorMessage =
          statsQuery?.error?.message || "Could not load dashboard stats";
        if (
          errorMessage.includes("403") ||
          errorMessage.includes("401") ||
          errorMessage.includes("Forbidden") ||
          errorMessage.includes("Unauthorized")
        ) {
          return "Access denied.";
        }
        return errorMessage;
      })()
    : null;

  useEffect(() => {
    if (!userLoading && user && staffProfileQuery.isSuccess && !staffProfile) {
      window.location.href = "/onboarding";
    }
  }, [userLoading, user, staffProfileQuery.isSuccess, staffProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/account/signin";
    }
    return null;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-UG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  };

  const s = stats?.stats || null;

  // KPI row values
  const portfolio = s ? Number(s.portfolio || 0) : 0;
  const managementFeesAccrued = s ? Number(s.managementFeesAccrued || 0) : 0;
  const managementFeesThisMonth = s
    ? Number(s.managementFeesThisMonth || 0)
    : 0;
  const amountDueToLandlords = s ? Number(s.amountDueToLandlords || 0) : 0;
  const arrearsNotPaidInIssueMonth = s
    ? Number(s.arrearsNotPaidInIssueMonth || 0)
    : 0;

  // Collection values
  const totalRent = s ? Number(s.totalRent || 0) : 0;
  const rentCollected = s ? Number(s.rentCollected || 0) : 0;
  const collectionRate = totalRent > 0 ? (rentCollected / totalRent) * 100 : 0;
  const collectionRateText = `${collectionRate.toFixed(0)}%`;
  const remainingThisMonth = Math.max(totalRent - rentCollected, 0);
  const collectionPie = [
    { name: "Collected", value: Number(rentCollected || 0) },
    { name: "Remaining", value: Number(remainingThisMonth || 0) },
  ];
  const collectionColor = collectionRate >= 50 ? "#062e03" : "#950606";
  const pieColors = [collectionColor, "#e5e7eb"];

  // Balance values
  const cashBalance = s ? Number(s.cashBalance || 0) : 0;
  const bankBalance = s ? Number(s.bankBalance || 0) : 0;
  const undepositedFundsBalance = s
    ? Number(s.undepositedFundsBalance || 0)
    : 0;
  const salaryOfficeExpensesThisMonth = s
    ? Number(s.salaryOfficeExpensesThisMonth || 0)
    : 0;

  // P&L series
  const plSeries = stats?.plSeries || [];
  const plSeriesHasData = plSeries.some(
    (r) => Number(r.income || 0) > 0 || Number(r.expenses || 0) > 0,
  );
  const plSeriesWithNet = (plSeries || []).map((r) => {
    const income = Number(r.income || 0);
    const expenses = Number(r.expenses || 0);
    return { ...r, net: income - expenses };
  });

  const landlordBalances = stats?.landlordBalances || [];
  const undepositedFundsLines = undepositedLinesQuery.data || [];
  const undepositedLinesLoading = undepositedLinesQuery.isLoading;
  const undepositedLinesError = undepositedLinesQuery.isError
    ? undepositedLinesQuery?.error?.message ||
      "Could not load undeposited funds"
    : null;

  const formatShortDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const totalRentText = formatCurrency(totalRent);

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Dashboard"
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
          <div className="mb-1">
            <h1 className="text-2xl font-semibold text-slate-800">
              Dashboard Overview
            </h1>
            <p className="text-slate-500">
              Welcome back, {staffProfile?.full_name || user?.name}
            </p>
          </div>

          {statsError ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">
              <div className="font-semibold">
                Dashboard stats could not load
              </div>
              <div className="text-sm mt-1">{statsError}</div>
            </div>
          ) : null}

          {/* 1) KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <KpiCard
              title="Portfolio (UGX)"
              value={formatCurrency(portfolio)}
            />
            <KpiCard
              title="Management Fees Accrued (UGX)"
              value={formatCurrency(managementFeesAccrued)}
            />
            <KpiCard
              title="Management Fees Collected (UGX)"
              value={formatCurrency(managementFeesThisMonth)}
            />
            <KpiCard
              title="Due to Landlords (UGX)"
              value={formatCurrency(amountDueToLandlords)}
            />
            <KpiCard
              title="Arrears (UGX)"
              value={formatCurrency(arrearsNotPaidInIssueMonth)}
              valueClassName={
                arrearsNotPaidInIssueMonth > 0
                  ? "text-[#950606]"
                  : "text-slate-800"
              }
            />
          </div>

          {/* 2) Charts row - lazy loaded */}
          <Suspense
            fallback={
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-[300px] animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-full bg-gray-100 rounded"></div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-[300px] animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
                  <div className="h-full bg-gray-100 rounded-full"></div>
                </div>
              </div>
            }
          >
            <DashboardCharts
              plSeriesWithNet={plSeriesWithNet}
              plSeriesHasData={plSeriesHasData}
              collectionPie={collectionPie}
              pieColors={pieColors}
              collectionRateText={collectionRateText}
              rentCollected={rentCollected}
              remainingThisMonth={remainingThisMonth}
              formatCurrency={formatCurrency}
              totalRentText={totalRentText}
            />
          </Suspense>

          {/* 3) Balances + landlord balances row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  Account balances (UGX)
                </div>
                <a
                  href="/accounting/balance-sheet"
                  className="text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  Balance sheet →
                </a>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <BalanceTile
                  title="Cash On Hand"
                  value={formatCurrency(cashBalance)}
                  icon={<Wallet className="w-4 h-4" />}
                />
                <BalanceTile
                  title="Bank Account - Operating"
                  value={formatCurrency(bankBalance)}
                  icon={<Landmark className="w-4 h-4" />}
                />
                <BalanceTile
                  title="Undeposited"
                  value={formatCurrency(undepositedFundsBalance)}
                  icon={<Wallet className="w-4 h-4" />}
                  onClick={() => setUndepositedOpen(true)}
                />
                <BalanceTile
                  title="Salary & Office Expenses"
                  value={formatCurrency(salaryOfficeExpensesThisMonth)}
                  icon={<Receipt className="w-4 h-4" />}
                />
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Undeposited opens the drilldown list.
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  Landlord balances (due)
                </div>
                <a
                  href="/landlords"
                  className="text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  Landlords →
                </a>
              </div>

              {landlordBalances.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No landlords yet.
                </p>
              ) : (
                <>
                  <div className="mt-3 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-3">Landlord</th>
                          <th className="py-2 pr-3">Next due</th>
                          <th className="py-2 pr-3 text-right">
                            Balance (UGX)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {landlordBalances.slice(0, 3).map((l) => {
                          const name = `${l.title ? `${l.title} ` : ""}${l.full_name}`;
                          const dueText = formatShortDate(l.next_due_date);
                          const balanceText = formatCurrency(l.balance);
                          const rowKey = `landlord-${l.id}`;

                          const isDueWithin3Days = (() => {
                            if (!l.next_due_date) return false;
                            const dueDate = new Date(l.next_due_date);
                            const now = new Date();
                            const threeDaysFromNow = new Date();
                            threeDaysFromNow.setDate(now.getDate() + 3);
                            return (
                              dueDate <= threeDaysFromNow && dueDate >= now
                            );
                          })();

                          const rowClass = isDueWithin3Days
                            ? "border-b last:border-b-0 bg-red-50"
                            : "border-b last:border-b-0";

                          return (
                            <tr key={rowKey} className={rowClass}>
                              <td className="py-2 pr-3">
                                <a
                                  href="/landlords"
                                  className="text-slate-700 hover:text-violet-600"
                                >
                                  {name}
                                </a>
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {dueText}
                              </td>
                              <td className="py-2 pr-3 text-right font-medium">
                                {balanceText}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {landlordBalances.length > 3 && (
                    <div className="mt-3 text-right">
                      <a
                        href="/reports?report=consolidated-balances-due"
                        className="text-sm font-medium text-violet-600 hover:text-violet-700"
                      >
                        View all →
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <QuickLinkTile href="/properties?newUnit=1">
              <div className="flex items-center gap-2">
                <PlusSquare className="w-4 h-4 text-white" />
                <span>Add Unit</span>
              </div>
            </QuickLinkTile>
            <QuickLinkTile href="/tenants?new=1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-white" />
                <span>Add Tenant</span>
              </div>
            </QuickLinkTile>
            <QuickLinkTile href="/accounting/deposit-funds">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-white" />
                <span>Deposit Funds</span>
              </div>
            </QuickLinkTile>
            <QuickLinkTile href="/payments?new=1">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-white" />
                <span>Record Payment</span>
              </div>
            </QuickLinkTile>
            <QuickLinkTile href="/accounting?tab=statements">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-white" />
                <span>Statements</span>
              </div>
            </QuickLinkTile>
          </div>
        </div>
      </main>

      {/* Undeposited Funds modal */}
      {undepositedOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setUndepositedOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="text-lg font-semibold text-slate-800">
                  Undeposited Funds
                </div>
                <div className="text-sm text-slate-500">
                  Balance: {formatCurrency(undepositedFundsBalance)} (UGX)
                </div>
              </div>
              <button
                onClick={() => setUndepositedOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {undepositedLinesError ? (
                <div className="mb-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
                  {undepositedLinesError}
                </div>
              ) : null}

              {undepositedLinesLoading ? (
                <p className="text-slate-500 text-center py-6">
                  Loading undeposited funds...
                </p>
              ) : undepositedFundsLines.length === 0 ? (
                <p className="text-slate-500 text-center py-6">
                  No undeposited funds yet.
                </p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-3">Tenant / Details</th>
                        <th className="py-2 pr-3 text-right">Amount (UGX)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {undepositedFundsLines.map((r) => {
                        const amountText = formatCurrency(Math.abs(r.amount));
                        const isIn = Number(r.amount) >= 0;
                        const signedText = isIn ? amountText : `-${amountText}`;
                        const amountClass = isIn
                          ? "text-green-700"
                          : "text-rose-700";

                        return (
                          <tr key={r.id} className="border-b last:border-b-0">
                            <td className="py-2 pr-3 text-slate-700">
                              {r.name}
                            </td>
                            <td
                              className={`py-2 pr-3 text-right font-medium ${amountClass}`}
                            >
                              {signedText}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setUndepositedOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ title, value, suffix, valueClassName }) {
  const suffixText = suffix ? ` ${suffix}` : "";
  const valueText = `${value}${suffixText}`;
  const valueClass = valueClassName || "text-slate-800";

  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
      <div className="text-center flex flex-col items-center justify-center">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </div>
        <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>
          {valueText}
        </div>
      </div>
    </div>
  );
}

function BalanceTile({ title, value, icon, onClick }) {
  const baseClass =
    "relative rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-center";

  const inner = (
    <>
      <div className="text-center">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </div>
        <div className="mt-2 text-2xl font-semibold text-slate-800">
          {value}
        </div>
      </div>
      {icon ? (
        <div className="absolute top-3 right-3 text-slate-400">{icon}</div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} text-left hover:bg-gray-100`}
      >
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
