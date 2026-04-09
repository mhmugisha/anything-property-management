import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { ChevronDown, ChevronRight } from "lucide-react";

export function StatementCard({
  title,
  rows,
  getRowHref,
  showTotal = true,
  amountHeader,
  onRowToggle,
  expandedRowId,
  renderExpandedRow,
}) {
  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // NEW: when totals are hidden (like on Balance Sheet), show the currency header
  // on the same line as the section title.
  const headerRight = showTotal
    ? formatCurrencyUGX(total)
    : amountHeader
      ? amountHeader
      : null;

  const shouldShowHeaderRight = showTotal || (!!amountHeader && !showTotal);
  const shouldShowAmountHeaderRow = !!amountHeader && showTotal;

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {shouldShowHeaderRight ? (
          <div
            className={
              showTotal
                ? "text-sm font-semibold text-slate-900 whitespace-nowrap"
                : "text-xs font-medium text-slate-500 whitespace-nowrap"
            }
          >
            {headerRight}
          </div>
        ) : null}
      </div>

      {shouldShowAmountHeaderRow ? (
        <div className="mb-2 flex items-center justify-between">
          <div />
          <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
            {amountHeader}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">No rows</div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
          {rows.map((r) => {
            const amountText = formatCurrencyUGX(r.amount);
            const accountCode = r.account_code;
            const accountName = r.account_name;
            const label = `${accountCode} ${accountName}`;
            const href = getRowHref ? getRowHref(r) : null;
            const key = r.id;

            const isExpanded = expandedRowId === r.id;
            const canToggle = typeof onRowToggle === "function";
            const showChevron = canToggle;
            const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm">
                  {href ? (
                    <a
                      href={href}
                      className="text-slate-700 pr-3 hover:text-violet-700"
                    >
                      {label}
                    </a>
                  ) : canToggle ? (
                    <button
                      type="button"
                      onClick={() => onRowToggle(r)}
                      className="text-slate-700 pr-3 hover:text-violet-700 text-left flex items-center gap-2"
                    >
                      {showChevron ? (
                        <ChevronIcon size={16} className="text-slate-500" />
                      ) : null}
                      <span className="font-mono">{accountCode}</span>
                      <span>{accountName}</span>
                    </button>
                  ) : (
                    <div className="text-slate-700 pr-3">{label}</div>
                  )}

                  <div className="font-medium text-slate-900 whitespace-nowrap">
                    {amountText}
                  </div>
                </div>

                {isExpanded && typeof renderExpandedRow === "function" ? (
                  <div className="mt-2 rounded-xl border border-gray-100 bg-white p-3">
                    {renderExpandedRow(r)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
