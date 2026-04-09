export function StatementsTab({ from, to }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Statements</h2>
      <p className="text-sm text-slate-500 mb-4">
        Open a statement below. Only that one report will display.
      </p>

      <div className="space-y-2">
        <a
          href={`/accounting/trial-balance${suffix}`}
          className="block rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-white"
        >
          <div className="font-medium text-slate-800">Trial Balance</div>
          <div className="text-xs text-slate-500">
            Debits vs credits by account
          </div>
        </a>

        <a
          href={`/accounting/profit-loss${suffix}`}
          className="block rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-white"
        >
          <div className="font-medium text-slate-800">Profit & Loss</div>
          <div className="text-xs text-slate-500">
            Income and expenses (totals per account)
          </div>
        </a>

        <a
          href={`/accounting/balance-sheet${suffix}`}
          className="block rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-white"
        >
          <div className="font-medium text-slate-800">Balance Sheet</div>
          <div className="text-xs text-slate-500">
            Assets, liabilities, and equity
          </div>
        </a>
      </div>
    </div>
  );
}
