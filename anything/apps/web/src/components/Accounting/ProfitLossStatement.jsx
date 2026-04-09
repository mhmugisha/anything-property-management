import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { StatementCard } from "./StatementCard";

export function ProfitLossStatement({
  income,
  expenses,
  totals,
  isLoading,
  error,
  from,
  to,
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">Could not load P&L.</p>;
  }

  const getRowHref = (row) => {
    const accountId = row?.account_id;
    if (!accountId) return null;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    const suffix = qs ? `?${qs}` : "";
    return `/accounting/accounts/${accountId}${suffix}`;
  };

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatementCard title="Income" rows={income} getRowHref={getRowHref} />
        <StatementCard
          title="Expenses"
          rows={expenses}
          getRowHref={getRowHref}
        />
      </div>

      {totals ? (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">Net profit</div>
            <div className="font-semibold text-slate-900">
              {formatCurrencyUGX(totals.netProfit)}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
