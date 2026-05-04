export default function DashboardSidebar() {
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
        <a
          href="/dashboard/due-to-landlords"
          className="flex items-center px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors text-sm font-medium"
        >
          Due to Landlords
        </a>
        <a
          href="/payments/open-balances"
          className="flex items-center px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors text-sm font-medium"
        >
          Open Balances
        </a>
        <a
          href="/accounting/chart-of-accounts"
          className="flex items-center px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors text-sm font-medium"
        >
          Chart of Accounts
        </a>
        <a
          href="/reports?report=payment-status"
          className="flex items-center px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors text-sm font-medium"
        >
          Payment Status
        </a>

      </div>
    </div>
  );
}
