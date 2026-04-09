import { Plus, Search } from "lucide-react";

export function PropertiesList({
  properties,
  search,
  onSearchChange,
  selectedPropertyId,
  onSelectProperty,
  onCreateProperty,
  isLoading,
  error,
}) {
  return (
    <div className="lg:w-[380px] w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-800">Properties</h2>
        <button
          onClick={onCreateProperty}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name or address"
          className="w-full pl-10 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : error ? (
        <p className="text-rose-600 text-sm">Could not load properties</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {properties.length === 0 ? (
            <p className="text-slate-500 text-sm">No properties yet.</p>
          ) : (
            properties.map((p) => {
              const isActive = p.id === selectedPropertyId;
              const activeClasses = isActive
                ? "border-sky-200 bg-sky-50"
                : "border-gray-100 bg-white hover:bg-gray-50";
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProperty(p.id)}
                  className={`w-full text-left p-3 rounded-xl border ${activeClasses}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800">
                        {p.property_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{p.address}</p>
                    </div>
                    <span className="text-xs text-slate-600 bg-white border border-gray-100 rounded-full px-2 py-1">
                      {p.total_units || 0} units
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
