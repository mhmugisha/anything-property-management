"use client";

import { Search, Plus, Users } from "lucide-react";

function getDisplayStatus(tenant) {
  const tenantStatus = (tenant?.status || "active").toLowerCase();
  if (tenantStatus === "archived") return "archived";
  const leaseStatus = (tenant?.lease_status || "").toLowerCase();
  if (leaseStatus === "ended") return "ended";
  return "active";
}

export default function TenantsSidebar({
  /* Landlord selector */
  landlordOptions = [],
  selectedLandlordId,
  onSelectLandlord,
  landlordsLoading = false,

  /* Property list */
  properties = [],
  selectedPropertyId,
  onSelectProperty,
  propertiesLoading = false,
  isAllLandlordsSelected = false,

  /* Tenants */
  tenants = [],
  search = "",
  onSearchChange,
  selectedTenantId,
  onSelectTenant,
  onStartCreate,
  tenantsLoading = false,
  showArchived = false,
  onToggleShowArchived,

  /* Prefetch */
  onPrefetchProperty,
}) {
  const filteredTenants = tenants.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.full_name?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q)
    );
  });

  const hasPropertySelected = !!selectedPropertyId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-600">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Tenants Menu
        </div>
      </div>

      {/* New Tenant */}
      <div className="px-3 pt-3 pb-3 border-b border-white/10">
        <button
          onClick={onStartCreate}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#0e1e6c] hover:bg-[#12278a] text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Tenant</span>
        </button>
      </div>

      {/* Landlord dropdown */}
      <div className="px-3 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1.5">
          Landlord
        </div>
        <select
          value={selectedLandlordId || ""}
          onChange={(e) => onSelectLandlord?.(e.target.value || null)}
          className="w-full px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">Select landlord…</option>
          {landlordOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {landlordsLoading && (
          <p className="mt-1 text-xs text-slate-400">Loading…</p>
        )}
      </div>

      {/* Properties */}
      {selectedLandlordId ? (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1.5">
            Property
          </div>
          {propertiesLoading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : properties.length === 0 ? (
            <p className="text-xs text-slate-400">No properties</p>
          ) : (
            <div className="space-y-1 max-h-[30vh] overflow-auto pr-1">
              {properties.map((p) => {
                const isAllValue = String(p.id) === "all";
                const isSelected = String(selectedPropertyId) === String(p.id);

                const subText = isAllValue
                  ? isAllLandlordsSelected
                    ? "Across all landlords"
                    : "Across this landlord"
                  : p.address || "";

                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProperty?.(p.id)}
                    onMouseEnter={() => onPrefetchProperty?.(p.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? "bg-white/15 text-white"
                        : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-medium truncate">
                      {p.property_name || p.label || "All properties"}
                    </div>
                    {subText && (
                      <div className="text-xs text-slate-400 truncate">
                        {subText}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Tenant search + list (shown when property is selected) */}
      {hasPropertySelected ? (
        <>
          <div className="px-3 py-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => onToggleShowArchived?.(e.target.checked)}
                className="rounded"
              />
              <span>Show archived / ended</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tenantsLoading ? (
              <div className="px-3 py-4 text-slate-400 text-sm">Loading…</div>
            ) : filteredTenants.length === 0 ? (
              <div className="px-3 py-4 text-slate-400 text-sm">
                {search ? "No tenants found" : "No tenants yet"}
              </div>
            ) : (
              <div className="py-2">
                {filteredTenants.map((tenant) => {
                  const isSelected =
                    selectedTenantId != null &&
                    Number(tenant.id) === Number(selectedTenantId);
                  const displayStatus = getDisplayStatus(tenant);
                  const isInactive = displayStatus !== "active";

                  const statusColor = isInactive
                    ? "text-amber-400"
                    : "text-green-400";

                  return (
                    <button
                      key={tenant.id}
                      onClick={() => onSelectTenant?.(tenant)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-white/15 text-white"
                          : "text-slate-200 hover:bg-white/10"
                      }`}
                      style={{ maxWidth: "calc(100% - 16px)" }}
                    >
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">
                            {tenant.title ? `${tenant.title} ` : ""}
                            {tenant.full_name}
                          </div>
                          <span
                            className={`text-xs flex-shrink-0 ${statusColor}`}
                          >
                            {displayStatus}
                          </span>
                        </div>
                        {tenant.phone && (
                          <div className="text-xs text-slate-400 truncate">
                            {tenant.phone}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-3">
          <p className="text-sm text-slate-400 text-center">
            {selectedLandlordId
              ? "Pick a property to see tenants"
              : "Select a landlord first"}
          </p>
        </div>
      )}
    </div>
  );
}
