import { Building } from "lucide-react";
import { formatCurrencyUGX } from "@/utils/formatters";
import { useState } from "react";

export function PropertiesCard({
  properties,
  isLoading,
  selectedPropertyId,
  onSelectProperty,
}) {
  const [showAll, setShowAll] = useState(false);

  const displayProperties = showAll ? properties : properties.slice(0, 3);
  const hasMore = properties.length > 3;

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Building className="w-4 h-4 text-slate-500" />
        <div className="text-sm font-semibold text-slate-800">Properties</div>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : properties.length === 0 ? (
        <div className="text-sm text-slate-500">
          No properties linked yet. Assign a landlord on the Properties page.
        </div>
      ) : (
        <>
          <div
            className={`space-y-2 ${showAll && hasMore ? "max-h-[400px] overflow-y-auto pr-1" : ""}`}
          >
            {displayProperties.map((p) => {
              const feeType = p.management_fee_type || "percent";
              const feeLabel =
                feeType === "fixed"
                  ? `Management fee: ${formatCurrencyUGX(
                      p.management_fee_fixed_amount || 0,
                    )} (fixed)`
                  : `Management fee: ${Number(p.management_fee_percent || 0)}%`;

              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProperty(String(p.id))}
                  className={`w-full text-left rounded-xl border px-3 py-2 ${
                    String(selectedPropertyId) === String(p.id)
                      ? "border-sky-200 bg-sky-50"
                      : "border-gray-100 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-medium text-slate-800">
                    {p.property_name}
                  </div>
                  <div className="text-xs text-slate-500">{feeLabel}</div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {showAll ? "Show less" : "Show all"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
