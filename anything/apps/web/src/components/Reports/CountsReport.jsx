import { useRef } from "react";
import { SummaryCard } from "./SummaryCard";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

const numberFormatter = new Intl.NumberFormat("en-US");
const fmt = (n) => numberFormatter.format(Number(n || 0));

function Section({ title, cards }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <SummaryCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
    </div>
  );
}

export function CountsReport({ countsQuery }) {
  const printRef = useRef(null);
  const data = countsQuery.data || {};

  const errorMessage = countsQuery.error
    ? countsQuery.error.message || "Could not load counts summary."
    : null;

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Counts</h2>
          <p className="text-sm text-slate-500">
            Totals across tenants, landlords, properties, units, and leases
          </p>
        </div>
        <div className="flex gap-2 sm:ml-auto" data-no-print="true">
          <PrintPreviewButtons targetRef={printRef} title="Counts" />
        </div>
      </div>

      {countsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : countsQuery.error ? (
        <div className="text-sm text-rose-600">
          <div>Could not load counts summary.</div>
          <div className="text-xs text-rose-500 mt-1">{errorMessage}</div>
        </div>
      ) : (
        <>
          <Section
            title="Tenants"
            cards={[
              { label: "Total", value: fmt(data.tenants_total) },
              { label: "Active", value: fmt(data.tenants_active) },
              { label: "Archived", value: fmt(data.tenants_archived) },
            ]}
          />
          <Section
            title="Landlords"
            cards={[
              { label: "Total", value: fmt(data.landlords_total) },
              { label: "Active", value: fmt(data.landlords_active) },
            ]}
          />
          <Section
            title="Properties"
            cards={[
              { label: "Total", value: fmt(data.properties_total) },
            ]}
          />
          <Section
            title="Units"
            cards={[
              { label: "Total", value: fmt(data.units_total) },
              { label: "Occupied", value: fmt(data.units_occupied) },
              { label: "Vacant", value: fmt(data.units_vacant) },
            ]}
          />
          <Section
            title="Leases"
            cards={[
              { label: "Total", value: fmt(data.leases_total) },
              { label: "Active", value: fmt(data.leases_active) },
              { label: "Ended", value: fmt(data.leases_ended) },
            ]}
          />
        </>
      )}
    </div>
  );
}
