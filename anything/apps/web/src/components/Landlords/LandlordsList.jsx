import { Plus, Search } from "lucide-react";
import { ordinalDay } from "@/utils/formatters";

export function LandlordsList({
  landlords,
  isLoading,
  search,
  onSearchChange,
  selectedId,
  onSelectLandlord,
  onCreateNew,
  showArchived,
  onToggleShowArchived,
}) {
  const onToggle = (e) => {
    if (!onToggleShowArchived) return;
    onToggleShowArchived(e.target.checked);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-lg font-semibold text-slate-800">Landlords</div>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 mb-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search landlord"
          className="w-full bg-transparent outline-none text-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : landlords.length === 0 ? (
        <div className="text-sm text-slate-500">No landlords yet.</div>
      ) : (
        <div className="space-y-2">
          {landlords.map((l) => {
            const active = Number(l.id) === Number(selectedId);
            const classes = active
              ? "border-sky-200 bg-sky-50"
              : "border-gray-100 bg-white hover:bg-gray-50";

            const name = `${l.title ? `${l.title} ` : ""}${l.full_name}`;
            const dueText = l.due_day
              ? `${ordinalDay(l.due_day)} every month`
              : "—";
            const statusText = l.status || "active";

            return (
              <button
                key={l.id}
                onClick={() => onSelectLandlord(l.id)}
                className={`w-full text-left rounded-xl border p-3 ${classes}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800">{name}</div>
                  <span className="text-xs text-slate-500">{statusText}</span>
                </div>
                <div className="text-xs text-slate-500">Due day: {dueText}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
