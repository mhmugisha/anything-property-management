export function InfoCard({ title, value, icon }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="text-slate-400">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="mt-2 text-sm font-medium text-slate-800 break-words">
        {value}
      </div>
    </div>
  );
}
