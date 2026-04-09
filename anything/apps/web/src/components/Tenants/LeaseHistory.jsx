import { formatDate } from "@/utils/formatDate";

export function LeaseHistory({ leases, isLoading }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">
        Lease history
      </h3>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading leases…</p>
      ) : leases.length === 0 ? (
        <p className="text-sm text-slate-500">
          No leases found for this tenant.
        </p>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
          {leases.map((l) => {
            const label = `${l.property_name || ""} • Unit ${l.unit_number || ""}`;
            const dates = `${formatDate(l.start_date)} → ${formatDate(l.end_date)}`;
            const amount = `${l.currency} ${Number(l.monthly_rent).toLocaleString()}`;

            return (
              <div
                key={l.id}
                className="rounded-xl bg-white border border-gray-100 p-3"
              >
                <div className="font-medium text-slate-800">{label}</div>
                <div className="text-sm text-slate-500">{dates}</div>
                <div className="text-sm text-slate-700 mt-1">{amount}</div>
                <div className="text-xs text-slate-500 mt-1">
                  status: {l.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
