export default function DashboardSidebar() {
  return (
    <div className="text-slate-200 text-sm">
      <div className="px-4 py-2 text-slate-400 uppercase tracking-wide text-xs font-semibold">
        Dashboard
      </div>
      <a
        href="/dashboard/due-to-landlords"
        className="block px-6 py-2 hover:bg-slate-700/50 text-slate-200"
      >
        Due to Landlords
      </a>
      <a
        href="/payments/open-balances"
        className="block px-6 py-2 hover:bg-slate-700/50 text-slate-200"
      >
        Open Balances
      </a>
      <a
        href="/accounting/chart-of-accounts"
        className="block px-6 py-2 hover:bg-slate-700/50 text-slate-200"
      >
        Chart of Accounts
      </a>
      <a
        href="/reports?report=payment-status"
        className="block px-6 py-2 hover:bg-slate-700/50 text-slate-200"
      >
        Payment Status
      </a>
    </div>
  );
}
