import { useState } from "react";
import { Field } from "./Field";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { usePropertyStatement } from "@/hooks/usePropertyStatement";
import { useRef } from "react";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

export function PropertyStatementReport({
  propertiesLookup,
  userLoading,
  user,
  canViewReports,
}) {
  const printRef = useRef(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  const propertyStatementQuery = usePropertyStatement(
    selectedPropertyId,
    !userLoading && !!user && canViewReports,
  );

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Property statement
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Shows invoices and payments for a single property.
          </p>
        </div>
        <div className="sm:ml-auto" data-no-print="true">
          <PrintPreviewButtons
            targetRef={printRef}
            title="Property statement"
          />
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        data-no-print="true"
      >
        <Field label="Property">
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select property…</option>
            {propertiesLookup.map((p) => (
              <option key={p.id} value={p.id}>
                {p.property_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!selectedPropertyId ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-slate-500">
          Pick a property to view its statement.
        </div>
      ) : propertyStatementQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : propertyStatementQuery.error ? (
        <p className="mt-4 text-sm text-rose-600">
          Could not load property statement.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Invoices
            </h3>
            <div className="max-h-[360px] overflow-auto pr-1 space-y-2">
              {(propertyStatementQuery.data?.invoices || []).map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl bg-white border border-gray-100 p-3"
                >
                  <div className="font-medium text-slate-800">
                    {inv.description}
                  </div>
                  <div className="text-xs text-slate-500">
                    {inv.tenant_name} • Unit {inv.unit_number}
                  </div>
                  <div className="mt-1 text-sm text-slate-700 flex justify-between">
                    <div>{formatCurrencyUGX(inv.amount)}</div>
                    <div className="font-semibold text-slate-900">
                      Due: {formatCurrencyUGX(inv.outstanding)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Payments
            </h3>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Bold separator line between headers and first entry */}
                  <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Tenant</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(propertyStatementQuery.data?.payments || []).map((p) => (
                    <tr
                      key={`${p.id}-${p.invoice_id}`}
                      className="border-b last:border-b-2 last:border-slate-700"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {String(p.payment_date).slice(0, 10)}
                      </td>
                      <td className="py-2 pr-3">{p.tenant_name}</td>
                      <td className="py-2 pr-3 text-right font-medium text-slate-800">
                        {formatCurrencyUGX(p.amount_applied)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
