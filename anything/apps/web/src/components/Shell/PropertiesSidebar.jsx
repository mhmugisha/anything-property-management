"use client";

import { Search, Plus, Building } from "lucide-react";

export default function PropertiesSidebar({
  properties = [],
  isLoading = false,
  search = "",
  onSearchChange,
  selectedPropertyId,
  onSelectProperty,
  onCreateProperty,
}) {
  const filteredProperties = properties.filter((p) => {
    if (!search) return true;
    return (
      p.property_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-600">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Properties Menu
        </div>
      </div>

      {/* New Property button */}
      <div className="px-3 pt-3 pb-3 border-b border-white/10">
        <button
          onClick={onCreateProperty}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#0e1e6c] hover:bg-[#12278a] text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Property</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Properties list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-slate-400 text-sm">Loading...</div>
        ) : filteredProperties.length === 0 ? (
          <div className="px-3 py-4 text-slate-400 text-sm">
            {search ? "No properties found" : "No properties yet"}
          </div>
        ) : (
          <div className="py-2">
            {filteredProperties.map((property) => {
              const isSelected =
                selectedPropertyId != null &&
                Number(property.id) === Number(selectedPropertyId);

              return (
                <button
                  key={property.id}
                  onClick={() => onSelectProperty?.(property.id)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-white/15 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                  style={{ maxWidth: "calc(100% - 16px)" }}
                >
                  <Building className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {property.property_name}
                    </div>
                    {property.address && (
                      <div className="text-xs text-slate-400 truncate">
                        {property.address}
                      </div>
                    )}
                    <div className="text-xs text-slate-400">
                      {property.total_units || 0} units
                    </div>
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
