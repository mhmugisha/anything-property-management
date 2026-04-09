import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { StatementCard } from "./StatementCard";

export function BalanceSheetStatement({
  assets,
  liabilities,
  equity,
  totals,
  to,
  isLoading,
  error,
}) {
  const [expandedAccountId, setExpandedAccountId] = useState(null);

  const onRowToggle = (row) => {
    const nextId = row?.id;
    if (!nextId) return;
    setExpandedAccountId((cur) => (cur === nextId ? null : nextId));
  };

  const previewFrom = useMemo(() => {
    if (!to) return "";
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) return "";
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, [to]);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">Could not load balance sheet.</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatementCard
          title="Assets"
          rows={assets}
          showTotal={false}
          amountHeader="(UGX)"
          onRowToggle={onRowToggle}
          expandedRowId={expandedAccountId}
          renderExpandedRow={(row) => (
            <AccountStatementPreview
              accountId={row.id}
              from={previewFrom}
              to={to}
            />
          )}
        />
        <div className="space-y-4">
          <StatementCard
            title="Liabilities"
            rows={liabilities}
            showTotal={false}
            amountHeader="(UGX)"
            onRowToggle={onRowToggle}
            expandedRowId={expandedAccountId}
            renderExpandedRow={(row) => (
              <AccountStatementPreview
                accountId={row.id}
                from={previewFrom}
                to={to}
              />
            )}
          />
          <StatementCard
            title="Equity"
            rows={equity}
            showTotal={false}
            amountHeader="(UGX)"
            onRowToggle={onRowToggle}
            expandedRowId={expandedAccountId}
            renderExpandedRow={(row) =>
              row.id === "retained_earnings" ? (
                <RetainedEarningsPreview from={previewFrom} to={to} />
              ) : (
                <AccountStatementPreview
                  accountId={row.id}
                  from={previewFrom}
                  to={to}
                />
              )
            }
          />
        </div>
      </div>

      {totals ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-right">
              <div className="text-xs text-slate-500">Total Assets</div>
              <div className="mt-1 font-semibold text-slate-900">
                {formatCurrencyUGX(totals.totalAssets)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-right">
              <div className="text-xs text-slate-500">Liabilities + Equity</div>
              <div className="mt-1 font-semibold text-slate-900">
                {formatCurrencyUGX(totals.liabilitiesPlusEquity)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-semibold text-violet-900 mb-3">
              Total Equity Calculation
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="text-right">
                <div className="text-xs text-slate-600">Equity Accounts</div>
                <div className="font-medium text-slate-900">
                  {formatCurrencyUGX(
                    (totals.totalEquity || 0) - (totals.retainedEarnings || 0),
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-600">Retained Earnings</div>
                <div className="font-medium text-slate-900">
                  {formatCurrencyUGX(totals.retainedEarnings || 0)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-violet-700 font-semibold">
                  Total Equity
                </div>
                <div className="font-bold text-violet-900">
                  {formatCurrencyUGX(totals.totalEquity)}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500 text-center">
              Total Equity = Equity Accounts + Retained Earnings (Income -
              Expenses)
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ────────────────────────────────────────────────────────
   Retained Earnings Preview — shows P&L breakdown
   ──────────────────────────────────────────────────────── */
function RetainedEarningsPreview({ from, to }) {
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [from, to]);

  const plQuery = useQuery({
    queryKey: ["accounting", "retainedEarningsPL", from, to],
    queryFn: async () => {
      const url = qs ? `/api/accounting/pl?${qs}` : `/api/accounting/pl`;
      return fetchJson(url);
    },
  });

  const showFrom = from || "—";
  const showTo = to || "—";

  if (plQuery.isLoading) {
    return <div className="text-sm text-slate-500">Loading details…</div>;
  }

  if (plQuery.error) {
    return (
      <div className="text-sm text-rose-600">
        Could not load Profit &amp; Loss details.
      </div>
    );
  }

  const income = plQuery.data?.income || [];
  const expenses = plQuery.data?.expenses || [];
  const plTotals = plQuery.data?.totals || {};

  const totalIncome = plTotals.totalIncome || 0;
  const totalExpenses = plTotals.totalExpenses || 0;
  const netProfit = plTotals.netProfit || 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Retained Earnings — Profit &amp; Loss Breakdown
          </div>
          <div className="text-xs text-slate-500">
            Period: {showFrom} → {showTo}
          </div>
        </div>
        <a
          href={`/accounting?tab=statements&statement=pl&from=${encodeURIComponent(from || "")}&to=${encodeURIComponent(to || "")}`}
          className="text-xs text-violet-600 hover:text-violet-700 whitespace-nowrap"
        >
          Open full P&amp;L →
        </a>
      </div>

      {/* Income section */}
      <div>
        <div className="text-xs font-semibold text-green-700 mb-1 uppercase tracking-wide">
          Income
        </div>
        {income.length === 0 ? (
          <div className="text-xs text-slate-500">No income accounts.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-300">
                  <th className="py-1.5 pr-3">Account</th>
                  <th className="py-1.5 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {income.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3">
                      <span className="font-mono text-slate-500 mr-1">
                        {r.account_code}
                      </span>
                      {r.account_name}
                    </td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap font-medium text-green-700">
                      {formatCurrencyUGX(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="py-1.5 pr-3 font-semibold text-slate-800">
                    Total Income
                  </td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap font-bold text-green-800">
                    {formatCurrencyUGX(totalIncome)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Expenses section */}
      <div>
        <div className="text-xs font-semibold text-rose-700 mb-1 uppercase tracking-wide">
          Expenses
        </div>
        {expenses.length === 0 ? (
          <div className="text-xs text-slate-500">No expense accounts.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-300">
                  <th className="py-1.5 pr-3">Account</th>
                  <th className="py-1.5 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3">
                      <span className="font-mono text-slate-500 mr-1">
                        {r.account_code}
                      </span>
                      {r.account_name}
                    </td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap font-medium text-rose-700">
                      {formatCurrencyUGX(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td className="py-1.5 pr-3 font-semibold text-slate-800">
                    Total Expenses
                  </td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap font-bold text-rose-800">
                    {formatCurrencyUGX(totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Net Profit summary */}
      <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-violet-900">
          Net Profit (Retained Earnings)
        </div>
        <div className="text-sm font-bold text-violet-900">
          {formatCurrencyUGX(netProfit)}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Account Statement Preview (for normal accounts)
   ──────────────────────────────────────────────────────── */
function AccountStatementPreview({ accountId, from, to }) {
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [from, to]);

  const statementQuery = useQuery({
    queryKey: ["accounting", "accountStatementPreview", accountId, from, to],
    queryFn: async () => {
      const url = qs
        ? `/api/accounting/accounts/${accountId}/statement?${qs}`
        : `/api/accounting/accounts/${accountId}/statement`;
      return fetchJson(url);
    },
    enabled: !!accountId,
  });

  const account = statementQuery.data?.account || null;
  const allRows = statementQuery.data?.rows || [];

  const previewRows = useMemo(() => {
    const take = 20;
    if (!Array.isArray(allRows)) return [];
    if (allRows.length <= take) return allRows;
    return allRows.slice(allRows.length - take);
  }, [allRows]);

  const showFrom = from || "—";
  const showTo = to || "—";
  const title = account
    ? `Details: ${account.account_code} ${account.account_name}`
    : "Details";

  if (statementQuery.isLoading) {
    return <div className="text-sm text-slate-500">Loading details…</div>;
  }

  if (statementQuery.error) {
    return <div className="text-sm text-rose-600">Could not load details.</div>;
  }

  if (!account) {
    return <div className="text-sm text-slate-500">No details.</div>;
  }

  const fullStatementHref = `/accounting/accounts/${accountId}?from=${encodeURIComponent(
    from || "",
  )}&to=${encodeURIComponent(to || "")}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">
            Showing last {previewRows.length} transactions • {showFrom} →{" "}
            {showTo}
          </div>
        </div>
        <a
          href={fullStatementHref}
          className="text-xs text-violet-600 hover:text-violet-700 whitespace-nowrap"
        >
          Open full statement →
        </a>
      </div>

      {previewRows.length === 0 ? (
        <div className="text-sm text-slate-500">No transactions found.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 pr-3 text-right">Credit</th>
                <th className="py-2 pr-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r) => {
                const dateText = String(r.transaction_date).slice(0, 10);
                const debitText = r.debit ? formatCurrencyUGX(r.debit) : "—";
                const creditText = r.credit ? formatCurrencyUGX(r.credit) : "—";
                const balanceText = formatCurrencyUGX(r.balance);

                return (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-2 last:border-slate-700"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{dateText}</td>
                    <td className="py-2 pr-3">{r.description}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {debitText}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {creditText}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap font-semibold text-slate-900">
                      {balanceText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
