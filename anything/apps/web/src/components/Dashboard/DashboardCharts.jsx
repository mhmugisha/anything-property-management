import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
} from "recharts";

export default function DashboardCharts({
  plSeriesWithNet,
  plSeriesHasData,
  collectionPie,
  pieColors,
  collectionRateText,
  rentCollected,
  remainingThisMonth,
  formatCurrency,
  totalRentText,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
      {/* Profit & Loss monthly bars + line */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">
            Profit and Loss (Last 6 months)
          </div>
          <a
            href="/accounting/profit-loss"
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            P&L →
          </a>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#0E1D33]" />
            <div>Income</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            <div>Expenses</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-3 bg-sky-700" />
            <div>Net</div>
          </div>
        </div>

        <div className="mt-3 h-[240px]">
          {plSeriesHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={plSeriesWithNet}
                margin={{ left: 0, right: 16 }}
                barCategoryGap="9%"
                barGap={4}
              >
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
                <Tooltip
                  content={<DashboardTooltip formatCurrency={formatCurrency} />}
                />
                <Bar dataKey="expenses" fill="#9ca3af" name="Expenses" />
                <Bar dataKey="income" fill="#0E1D33" name="Income" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              No chart data yet.
            </div>
          )}
        </div>
      </div>

      {/* Collection donut */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="text-sm font-semibold text-slate-800 text-center">
          Collection rate (this month)
        </div>

        <div className="mt-2 text-center">
          <div className="text-xs text-slate-500">Total Rent (This month)</div>
          <div className="text-sm font-semibold text-slate-800">
            {totalRentText} UGX
          </div>
        </div>

        <div className="mt-3 h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={collectionPie}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={78}
                paddingAngle={2}
                stroke="none"
              >
                {collectionPie.map((_, index) => {
                  const fill = pieColors[index] || "#e5e7eb";
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Pie>
              <Tooltip
                content={<DashboardTooltip formatCurrency={formatCurrency} />}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-2xl font-semibold text-slate-800">
                {collectionRateText}
              </div>
              <div className="text-xs text-slate-500">collected</div>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
            <div className="text-xs text-slate-500">Collected</div>
            <div className="text-sm font-semibold text-slate-800">
              {formatCurrency(rentCollected)}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
            <div className="text-xs text-slate-500">Remaining</div>
            <div className="text-sm font-semibold text-slate-800">
              {formatCurrency(remainingThisMonth)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardTooltip({ active, payload, label, formatCurrency }) {
  if (!active) return null;
  if (!payload || payload.length === 0) return null;

  const rows = payload.map((p) => {
    const name = p.name || p.dataKey;
    const val = formatCurrency(p.value);
    return { name, val, color: p.color };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
      {label ? (
        <div className="text-xs text-slate-500 mb-1">{label}</div>
      ) : null}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-6">
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <div className="text-xs text-slate-700">{r.name}</div>
            </div>
            <div className="text-xs font-semibold text-slate-800">{r.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
