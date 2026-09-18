import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";

export default function DashboardSidebar() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const isPortfolioManager =
    staffQuery.data?.role_name === "Portfolio Manager";

  const linkClass =
    "flex items-center px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors text-sm font-medium";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Dashboard
        </div>
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {isPortfolioManager ? (
          <a href="/reports?report=manager-arrears" className={linkClass}>
            Manager Arrears
          </a>
        ) : (
          <>
            <a href="/dashboard/due-to-landlords" className={linkClass}>
              Due to Landlords
            </a>
            <a href="/payments/open-balances" className={linkClass}>
              Open Balances
            </a>
            <a href="/accounting/chart-of-accounts" className={linkClass}>
              Chart of Accounts
            </a>
            <a href="/reports?report=payment-status" className={linkClass}>
              Payment Status
            </a>
            <a href="/reports?report=all-landlords-balances" className={linkClass}>
              All Landlords Balances
            </a>
          </>
        )}
      </div>
    </div>
  );
}
