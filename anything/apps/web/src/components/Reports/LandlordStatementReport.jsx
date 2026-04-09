import { useState } from "react";
import { Field } from "./Field";
import { SummaryCard } from "./SummaryCard";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { useLandlordStatementReport } from "@/hooks/useLandlordStatementReport";
import { useRef } from "react";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";

export function LandlordStatementReport({
  landlordsLookup,
  userLoading,
  user,
  canViewReports,
}) {
  const printRef = useRef(null);
  const [selectedLandlordId, setSelectedLandlordId] = useState("");

  const landlordStatementQuery = useLandlordStatementReport(
    selectedLandlordId,
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
            Landlord statement
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Shows invoices, payments, and deductions for a landlord.
          </p>
        </div>

        <div className="sm:ml-auto" data-no-print="true">
          <PrintPreviewButtons
            targetRef={printRef}
            title="Landlord statement"
          />
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        data-no-print="true"
      >
        <Field label="Landlord">
          <select
            value={selectedLandlordId}
            onChange={(e) => setSelectedLandlordId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select landlord…</option>
            {landlordsLookup.map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!selectedLandlordId ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-slate-500">
          Pick a landlord to view their statement.
        </div>
      ) : landlordStatementQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : landlordStatementQuery.error ? (
        <p className="mt-4 text-sm text-rose-600">
          Could not load landlord statement.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard
              label="Gross rent"
              value={formatCurrencyUGX(
                landlordStatementQuery.data?.totals?.gross_rent,
              )}
            />
            <SummaryCard
              label="Total deductions"
              value={formatCurrencyUGX(
                (landlordStatementQuery.data?.totals?.management_fees || 0) +
                  (landlordStatementQuery.data?.totals?.deductions || 0) +
                  (landlordStatementQuery.data?.totals?.reversals || 0) +
                  (landlordStatementQuery.data?.totals?.payouts || 0),
              )}
            />
            <SummaryCard
              label="Closing balance (UGX)"
              value={formatCurrencyUGX(
                landlordStatementQuery.data?.totals?.net_due,
              )}
            />
          </div>

          {/* Statement Table */}
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">
                      Date
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">
                      Description
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-slate-700">
                      Property
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-700">
                      Debit
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-700">
                      Credit
                    </th>
                    <th className="py-3 px-4 text-right font-semibold text-slate-700">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Combine all transactions
                    const allTransactions = [];

                    // Add invoices as credits
                    (landlordStatementQuery.data?.invoices || []).forEach(
                      (inv) => {
                        allTransactions.push({
                          date: inv.invoice_date,
                          description: inv.description,
                          property: inv.property_name,
                          debit: 0,
                          credit: inv.amount,
                          type: "invoice",
                        });
                      },
                    );

                    // Add management fees as debits
                    // Group by property-month
                    const feeMap = new Map();
                    (landlordStatementQuery.data?.invoices || []).forEach(
                      (inv) => {
                        const key = `${inv.property_id}-${inv.invoice_year}-${inv.invoice_month}`;
                        if (!feeMap.has(key)) {
                          const gross = 0;
                          const feeType = inv.management_fee_type;
                          const percent = inv.management_fee_percent || 0;
                          const fixedAmount =
                            inv.management_fee_fixed_amount || 0;

                          feeMap.set(key, {
                            property_name: inv.property_name,
                            invoice_date: inv.invoice_date,
                            invoice_year: inv.invoice_year,
                            invoice_month: inv.invoice_month,
                            feeType,
                            percent,
                            fixedAmount,
                            invoices: [],
                          });
                        }
                        feeMap.get(key).invoices.push(inv);
                      },
                    );

                    feeMap.forEach((group) => {
                      const gross = group.invoices.reduce(
                        (sum, inv) => sum + Number(inv.amount || 0),
                        0,
                      );
                      let fee = 0;
                      if (group.feeType === "percent") {
                        fee =
                          Math.round(((gross * group.percent) / 100) * 100) /
                          100;
                      } else if (group.feeType === "fixed") {
                        fee = Math.min(group.fixedAmount, gross);
                      }

                      if (fee > 0) {
                        const monthNames = [
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ];
                        const monthName = monthNames[group.invoice_month - 1];
                        allTransactions.push({
                          date: group.invoice_date,
                          description: `Management fee - ${monthName} ${group.invoice_year}`,
                          property: group.property_name,
                          debit: fee,
                          credit: 0,
                          type: "fee",
                        });
                      }
                    });

                    // Add deductions as debits
                    (landlordStatementQuery.data?.deductions || []).forEach(
                      (ded) => {
                        allTransactions.push({
                          date: ded.deduction_date,
                          description: `Deduction - ${ded.description}`,
                          property: ded.property_name,
                          debit: ded.amount,
                          credit: 0,
                          type: "deduction",
                        });
                      },
                    );

                    // Add reversals as debits
                    (landlordStatementQuery.data?.reversals || []).forEach(
                      (rev) => {
                        allTransactions.push({
                          date: rev.transaction_date,
                          description: `Invoice reversal - ${rev.description}`,
                          property: rev.property_name,
                          debit: rev.amount,
                          credit: 0,
                          type: "reversal",
                        });
                      },
                    );

                    // Add payouts as debits
                    (landlordStatementQuery.data?.payouts || []).forEach(
                      (payout) => {
                        const ref = payout.reference_number
                          ? ` (${payout.reference_number})`
                          : "";
                        allTransactions.push({
                          date: payout.payout_date,
                          description: `Landlord payout - ${payout.payment_method}${ref}`,
                          property: payout.property_name,
                          debit: payout.amount,
                          credit: 0,
                          type: "payout",
                        });
                      },
                    );

                    // Sort by date
                    allTransactions.sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      if (dateA < dateB) return -1;
                      if (dateA > dateB) return 1;
                      // Credits first on same date
                      if (a.credit > 0 && b.credit === 0) return -1;
                      if (a.credit === 0 && b.credit > 0) return 1;
                      return 0;
                    });

                    // Calculate running balance
                    let balance = 0;
                    return allTransactions.map((tx, idx) => {
                      balance = balance + tx.credit - tx.debit;
                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                            {String(tx.date).slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {tx.description}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {tx.property || "-"}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700">
                            {tx.debit > 0 ? formatCurrencyUGX(tx.debit) : "-"}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700">
                            {tx.credit > 0 ? formatCurrencyUGX(tx.credit) : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            {formatCurrencyUGX(balance)}
                          </td>
                        </tr>
                      );
                    });
                  })()}

                  {/* Totals Row */}
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ALL-TIME TOTALS
                    </td>
                    <td className="py-3 px-4"></td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrencyUGX(
                        (landlordStatementQuery.data?.allTimeTotals
                          ?.management_fees || 0) +
                          (landlordStatementQuery.data?.allTimeTotals
                            ?.deductions || 0) +
                          (landlordStatementQuery.data?.allTimeTotals
                            ?.reversals || 0) +
                          (landlordStatementQuery.data?.allTimeTotals
                            ?.payouts || 0),
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrencyUGX(
                        landlordStatementQuery.data?.allTimeTotals?.gross_rent,
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 text-base">
                      {formatCurrencyUGX(
                        landlordStatementQuery.data?.allTimeTotals?.net_due,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
