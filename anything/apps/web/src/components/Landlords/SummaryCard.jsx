export function SummaryCard({ title, value, alignRight }) {
  const alignClass = alignRight ? "text-right" : "text-left";

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className={`text-xs text-slate-500 ${alignClass}`}>{title}</div>
      <div
        className={`text-lg font-semibold text-slate-900 mt-1 ${alignClass}`}
      >
        {value}
      </div>
    </div>
  );
}
