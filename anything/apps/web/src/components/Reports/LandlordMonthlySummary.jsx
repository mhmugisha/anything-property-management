import { useState, useCallback, Fragment } from "react";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { Field } from "./Field";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { downloadCsv } from "@/utils/downloadCsv";
import { useLandlordSummary } from "@/hooks/useLandlordSummary";
import { useRef } from "react";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

export function LandlordMonthlySummary({ userLoading, user, canViewReports }) {
  const printRef = useRef(null);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [expanded, setExpanded] = useState(null);

  const landlordSummaryQuery = useLandlordSummary(
    month,
    year,
    !userLoading && !!user && canViewReports,
  );

  const landlordSummary = landlordSummaryQuery.data;
  const landlordRows = landlordSummary?.landlords || [];

  const onExportLandlordSummary = useCallback(() => {
    const rows = [];
    for (const l of landlordRows) {
      rows.push({
        landlord: l.landlord_name,
        gross_rent: l.totals.gross_rent,
        management_fees: l.totals.management_fees,
        deductions: l.totals.deductions,
        net_due: l.totals.net_due,
      });
    }
    const filename = `landlord-summary-${year}-${month}.csv`;
    downloadCsv(filename, rows);
  }, [landlordRows, year, month]);

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Landlord monthly summary (payment note)
          </h2>
          <p className="text-sm text-slate-500">
            Shows gross rent, management fees, deductions, and net due per
            landlord. Expand a landlord to see property totals and
            tenant-by-tenant rents.
          </p>
        </div>
        <div className="flex gap-2 justify-end" data-no-print="true">
          <button
            onClick={onExportLandlordSummary}
            disabled={landlordRows.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <PrintPreviewButtons
            targetRef={printRef}
            title="Landlord monthly summary"
          />
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"
        data-no-print="true"
      >
        <Field label="Month">
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>
        <Field label="Year">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>
        <div className="text-xs text-slate-500 flex items-end">
          Tip: Month = 1..12
        </div>
      </div>

      {landlordSummaryQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : landlordSummaryQuery.error ? (
        <p className="text-sm text-rose-600">
          Could not load landlord summary.
        </p>
      ) : landlordRows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No landlord invoices found for this month.
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm border-b-2 border-slate-700">
            <thead>
              <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                <th className="py-2 pr-3">Landlord</th>
                <th className="py-2 pr-3 text-right">Gross rent</th>
                <th className="py-2 pr-3 text-right">Management fees</th>
                <th className="py-2 pr-3 text-right">Deductions</th>
                <th className="py-2 pr-3 text-right">Net due</th>
              </tr>
            </thead>
            <tbody>
              {landlordRows.map((l) => {
                const key = l.landlord_id || l.landlord_name;
                const isOpen = String(expanded) === String(key);

                const toggle = () => {
                  setExpanded((prev) => {
                    if (String(prev) === String(key)) return null;
                    return key;
                  });
                };

                return (
                  <Fragment key={key}>
                    <tr
                      className="border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
                      onClick={toggle}
                    >
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                          {l.landlord_name}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrencyUGX(l.totals.gross_rent)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrencyUGX(l.totals.management_fees)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrencyUGX(l.totals.deductions)}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                        {formatCurrencyUGX(l.totals.net_due)}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-b">
                        <td colSpan={5} className="py-3 pr-3">
                          <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-3">
                            {l.property_summaries?.length ? (
                              <div>
                                <div className="text-xs text-slate-500 mb-2">
                                  Property totals (this month)
                                </div>
                                <div className="overflow-auto">
                                  <table className="w-full text-xs border-b-2 border-slate-700">
                                    <thead>
                                      <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                                        <th className="py-2 pr-3">Property</th>
                                        <th className="py-2 pr-3 text-right">
                                          Gross
                                        </th>
                                        <th className="py-2 pr-3 text-right">
                                          Fee
                                        </th>
                                        <th className="py-2 pr-3 text-right">
                                          Net
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {l.property_summaries.map((ps) => (
                                        <tr
                                          key={ps.property_id}
                                          className="border-b last:border-b-0"
                                        >
                                          <td className="py-2 pr-3">
                                            {ps.property_name}
                                          </td>
                                          <td className="py-2 pr-3 text-right">
                                            {formatCurrencyUGX(ps.gross_rent)}
                                          </td>
                                          <td className="py-2 pr-3 text-right">
                                            {formatCurrencyUGX(
                                              ps.management_fees,
                                            )}
                                          </td>
                                          <td className="py-2 pr-3 text-right font-medium text-slate-800">
                                            {formatCurrencyUGX(ps.net_due)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <div className="text-xs text-slate-500 mb-2">
                                Tenants and rents (this month)
                              </div>
                              {l.lines?.length ? (
                                <div className="overflow-auto">
                                  <table className="w-full text-xs border-b-2 border-slate-700">
                                    <thead>
                                      <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                                        <th className="py-2 pr-3">Tenant</th>
                                        <th className="py-2 pr-3">Property</th>
                                        <th className="py-2 pr-3">Unit</th>
                                        <th className="py-2 pr-3 text-right">
                                          Rent
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {l.lines.map((line) => (
                                        <tr
                                          key={`${line.invoice_id}-${line.tenant_id}`}
                                          className="border-b last:border-b-0"
                                        >
                                          <td className="py-2 pr-3">
                                            {line.tenant_name}
                                          </td>
                                          <td className="py-2 pr-3">
                                            {line.property_name}
                                          </td>
                                          <td className="py-2 pr-3">
                                            {line.unit_number}
                                          </td>
                                          <td className="py-2 pr-3 text-right font-medium text-slate-800">
                                            {formatCurrencyUGX(
                                              line.rent_amount,
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-500">
                                  No lines.
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}

              {/* Totals Row */}
              {landlordSummary?.totals && (
                <tr className="border-t-2 border-slate-700">
                  <td className="py-3 pr-3 font-bold text-slate-900 text-base">
                    TOTALS
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-slate-900 text-base">
                    {formatCurrencyUGX(landlordSummary.totals.gross_rent)}
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-slate-900 text-base">
                    {formatCurrencyUGX(landlordSummary.totals.management_fees)}
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-slate-900 text-base">
                    {formatCurrencyUGX(landlordSummary.totals.deductions)}
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-slate-900 text-base">
                    {formatCurrencyUGX(landlordSummary.totals.net_due)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {landlordRows.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-bold text-slate-900">
                Total landlords: {landlordRows.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
