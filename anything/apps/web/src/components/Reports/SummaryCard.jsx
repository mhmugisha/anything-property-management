export function SummaryCard({ label, value, align = "left" }) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className={`text-xs text-slate-500 ${alignClass}`}>{label}</div>
      <div
        className={`mt-1 text-lg font-semibold text-slate-800 ${alignClass}`}
      >
        {value}
      </div>
    </div>
  );
}
