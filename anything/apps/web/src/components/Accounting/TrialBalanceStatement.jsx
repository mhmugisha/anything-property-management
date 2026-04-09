import { formatCurrencyUGX } from "@/utils/formatCurrency";

export function TrialBalanceStatement({ rows, totals, isLoading, error }) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">Could not load trial balance.</p>
    );
  }

  const safeRows = rows || [];
  const safeTotals = totals || null;

  const totalsDebitValue = safeTotals
    ? typeof safeTotals.debit_balance === "number"
      ? safeTotals.debit_balance
      : safeTotals.debit_total
    : 0;
  const totalsCreditValue = safeTotals
    ? typeof safeTotals.credit_balance === "number"
      ? safeTotals.credit_balance
      : safeTotals.credit_total
    : 0;

  const totalsDebitText = safeTotals ? formatCurrencyUGX(totalsDebitValue) : "";
  const totalsCreditText = safeTotals
    ? formatCurrencyUGX(totalsCreditValue)
    : "";

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          {/* Bold separator line between headers and first entry */}
          <tr className="text-left text-slate-500 border-b-2 border-slate-700">
            <th className="py-2 pr-3">Code</th>
            <th className="py-2 pr-3">Account</th>
            <th className="py-2 pr-3 text-right">Debit (UGX)</th>
            <th className="py-2 pr-3 text-right">Credit (UGX)</th>
          </tr>
        </thead>
        <tbody>
          {safeRows.map((r) => {
            // New API fields (preferred)
            const debitValue =
              typeof r.debit_balance === "number"
                ? r.debit_balance
                : Math.max(
                    Number(r.debit_total || 0) - Number(r.credit_total || 0),
                    0,
                  );
            const creditValue =
              typeof r.credit_balance === "number"
                ? r.credit_balance
                : Math.max(
                    Number(r.credit_total || 0) - Number(r.debit_total || 0),
                    0,
                  );

            const debitText = debitValue ? formatCurrencyUGX(debitValue) : "";
            const creditText = creditValue
              ? formatCurrencyUGX(creditValue)
              : "";

            return (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3 font-medium text-slate-800">
                  {r.account_code}
                </td>
                <td className="py-2 pr-3">{r.account_name}</td>
                <td className="py-2 pr-3 text-right">{debitText}</td>
                <td className="py-2 pr-3 text-right">{creditText}</td>
              </tr>
            );
          })}
        </tbody>
        {safeTotals ? (
          <tfoot>
            {/* Bold separator line above totals */}
            <tr className="border-t-2 border-slate-700">
              <td className="py-2 pr-3" />
              <td className="py-2 pr-3 font-semibold text-slate-800">Totals</td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-800">
                {totalsDebitText}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-800">
                {totalsCreditText}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>

      <div className="mt-3 text-xs text-slate-500">
        Note: each account shows a single balance side. (Behind the scenes, the
        system still tracks total debits and total credits posted to each
        account.)
      </div>
    </div>
  );
}
