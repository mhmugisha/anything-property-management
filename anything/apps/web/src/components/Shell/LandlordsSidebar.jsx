"use client";

import { Search, Plus, User } from "lucide-react";

export default function LandlordsSidebar({
  landlords = [],
  isLoading = false,
  search = "",
  onSearchChange,
  selectedLandlordId,
  onSelectLandlord,
  onCreateNew,
  showArchived = false,
  onToggleShowArchived,
}) {
  const filteredLandlords = landlords.filter((l) => {
    const matchesSearch =
      !search ||
      l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-600">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Landlords Menu
        </div>
      </div>

      {/* New Landlord button */}
      <div className="px-3 pt-3 pb-3 border-b border-white/10">
        <button
          onClick={onCreateNew}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#0e1e6c] hover:bg-[#12278a] text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Landlord</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search landlords..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Show archived toggle */}
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

      {/* Landlords list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-slate-400 text-sm">Loading...</div>
        ) : filteredLandlords.length === 0 ? (
          <div className="px-3 py-4 text-slate-400 text-sm">
            {search ? "No landlords found" : "No landlords yet"}
          </div>
        ) : (
          <div className="py-2">
            {filteredLandlords.map((landlord) => {
              const isSelected =
                selectedLandlordId != null &&
                Number(landlord.id) === Number(selectedLandlordId);
              const isArchived = landlord.status !== "active";

              return (
                <button
                  key={landlord.id}
                  onClick={() => onSelectLandlord?.(landlord.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-white/15 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                  style={{ maxWidth: "calc(100% - 16px)" }}
                >
                  <User className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {landlord.title ? `${landlord.title} ` : ""}
                      {landlord.full_name}
                    </div>
                    {landlord.phone && (
                      <div className="text-xs text-slate-400 truncate">
                        {landlord.phone}
                      </div>
                    )}
                    {isArchived && (
                      <div className="text-xs text-amber-400">
                        {landlord.status === "ended" ? "Ended" : "Archived"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
