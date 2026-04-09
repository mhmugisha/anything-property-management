import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

const UNITS_PER_PAGE = 7;

export function UnitsList({
  units,
  onCreateUnit,
  onEditUnit,
  onDeleteUnit,
  isLoading,
  error,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(units.length / UNITS_PER_PAGE));

  // Reset to page 1 if units length changes and current page is out of range
  const safePage = currentPage > totalPages ? 1 : currentPage;

  const startIdx = (safePage - 1) * UNITS_PER_PAGE;
  const paginatedUnits = units.slice(startIdx, startIdx + UNITS_PER_PAGE);

  const showPagination = units.length > UNITS_PER_PAGE;

  const formatUgx = (amount) => {
    if (amount === null || amount === undefined || amount === "") return "—";
    const n = Number(amount);
    if (!Number.isFinite(n)) return "—";

    return new Intl.NumberFormat("en-UG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  const goToPrev = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goToNext = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  // Build page numbers to display with ellipsis
  const pageNumbers = [];
  const maxVisiblePages = 4;

  if (totalPages <= maxVisiblePages + 1) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    // Show first 4 pages, then ellipsis, then last page
    for (let i = 1; i <= Math.min(maxVisiblePages, totalPages); i++) {
      pageNumbers.push(i);
    }
    if (totalPages > maxVisiblePages) {
      pageNumbers.push("...");
      pageNumbers.push(totalPages);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-800">
          Units
          {units.length > 0 && (
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({units.length})
            </span>
          )}
        </h3>
        <button
          onClick={onCreateUnit}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
        >
          <Plus className="w-4 h-4" />
          Add unit
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading units...</p>
      ) : error ? (
        <p className="text-sm text-rose-600">Could not load units</p>
      ) : units.length === 0 ? (
        <p className="text-slate-500 text-sm">No units yet.</p>
      ) : (
        <>
          <div className="overflow-auto rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-gray-100">
                  <th className="py-2 px-3 whitespace-nowrap">Unit</th>
                  <th className="py-2 px-3">Tenant</th>
                  <th className="py-2 px-3 whitespace-nowrap">Rent (UGX)</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">
                    {/* Actions */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedUnits.map((u) => {
                  const unitText = u.unit_number ? String(u.unit_number) : "—";

                  const tenantText = u.current_tenant_name
                    ? String(u.current_tenant_name)
                    : "—";

                  const rentText = formatUgx(u.monthly_rent_ugx);

                  return (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {unitText}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{tenantText}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {rentText}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onEditUnit(u)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteUnit(u)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showPagination && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500">
                Showing {startIdx + 1}–
                {Math.min(startIdx + UNITS_PER_PAGE, units.length)} of{" "}
                {units.length} units
              </p>

              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrev}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>

                {pageNumbers.map((page, idx) => {
                  if (page === "...") {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-slate-400"
                      >
                        ...
                      </span>
                    );
                  }
                  const isActive = page === safePage;
                  const activeClass = isActive
                    ? "bg-[#0B1F3A] text-white"
                    : "border border-gray-200 text-slate-600 hover:bg-gray-50";
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${activeClass}`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={goToNext}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
