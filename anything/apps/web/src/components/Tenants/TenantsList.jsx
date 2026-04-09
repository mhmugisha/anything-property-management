import { Plus, Search } from "lucide-react";

function getDisplayStatus(tenant) {
  const tenantStatus = (tenant?.status || "active").toLowerCase();
  if (tenantStatus === "archived") return "archived";

  const leaseStatus = (tenant?.lease_status || "").toLowerCase();
  if (leaseStatus === "ended") return "ended";

  return "active";
}

export function TenantsList({
  tenants,
  search,
  onSearchChange,
  selectedTenantId,
  onSelectTenant,
  onStartCreate,
  isLoading,
  isFetching,
  error,
  showArchived,
  onToggleShowArchived,
}) {
  const onToggle = (e) => {
    if (!onToggleShowArchived) return;
    onToggleShowArchived(e.target.checked);
  };

  const subtitleText = isFetching ? "Updating…" : null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Tenants</h2>
            {subtitleText ? (
              <span className="text-xs text-slate-500">{subtitleText}</span>
            ) : null}
          </div>
        </div>

        <button
          onClick={onStartCreate}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, phone, email"
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading tenants…</p>
      ) : error ? (
        <p className="text-sm text-rose-600">Could not load tenants.</p>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-slate-500">No tenants yet.</p>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
          {tenants.map((t) => {
            const isSelected = selectedTenantId === t.id;
            const displayStatus = getDisplayStatus(t);
            const isInactive = displayStatus !== "active";

            let rowClasses = "border-gray-100 hover:bg-gray-50";
            if (isInactive) {
              rowClasses = "border-gray-200 bg-gray-50";
            }
            if (isSelected) {
              rowClasses = "border-sky-200 bg-sky-50";
            }

            const nameClasses = isInactive
              ? "font-medium text-slate-500"
              : "font-medium text-slate-800";

            const phoneClasses = isInactive
              ? "text-sm text-slate-400"
              : "text-sm text-slate-500";

            const statusClasses = isInactive
              ? "text-xs text-slate-400"
              : "text-xs text-slate-500";

            return (
              <button
                key={t.id}
                onClick={() => onSelectTenant(t)}
                className={`w-full text-left rounded-xl border p-3 ${rowClasses}`}
              >
                <div className="flex items-center justify-between">
                  <div className={nameClasses}>{t.full_name}</div>
                  <span className={statusClasses}>{displayStatus}</span>
                </div>
                <div className={phoneClasses}>{t.phone}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
