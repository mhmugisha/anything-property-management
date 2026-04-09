import { Search, Printer } from "lucide-react";
import { useState, useMemo } from "react";
import DatePopoverInput from "@/components/DatePopoverInput";
import Pagination from "@/components/Pagination";
import { Field } from "./Field";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { formatDate } from "@/utils/formatters";

export function PaymentsTable({
  payments,
  isLoading,
  error,
  search,
  setSearch,
  from,
  setFrom,
  to,
  setTo,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 16;

  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return payments.slice(startIndex, endIndex);
  }, [payments, currentPage]);

  const totalPages = Math.ceil(payments.length / itemsPerPage);

  const handlePrintReceipt = (paymentId) => {
    window.open(`/payments/receipt/${paymentId}`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="flex gap-3 items-end">
          <div>
            <Field label="From">
              <DatePopoverInput
                value={from}
                onChange={setFrom}
                placeholder="DD-MM-YYYY"
                className="bg-gray-50 w-[120px]"
              />
            </Field>
          </div>
          <div>
            <Field label="To">
              <DatePopoverInput
                value={to}
                onChange={setTo}
                placeholder="DD-MM-YYYY"
                className="bg-gray-50 w-[120px]"
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant, property"
            className="w-64 max-w-full bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading payments…</p>
      ) : error ? (
        <p className="text-sm text-rose-600">Could not load payments.</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-500">No payments found.</p>
      ) : (
        <>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Receipt #</th>
                  <th className="py-2 pr-3">Tenant</th>
                  <th className="py-2 pr-3">Property</th>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3 text-right">Amount (UGX)</th>
                  <th className="py-2 pr-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((p) => {
                  const amountText = formatCurrencyUGX(p.amount);
                  const dateText = formatDate(p.payment_date);
                  const tenantName = p.tenant_name || "—";
                  const propertyName = p.property_name || "—";
                  const inv = p.invoice_description || "—";
                  const receiptNumber = p.reference_number || "—";

                  return (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {dateText}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {receiptNumber}
                      </td>
                      <td className="py-2 pr-3">{tenantName}</td>
                      <td className="py-2 pr-3">{propertyName}</td>
                      <td className="py-2 pr-3">{inv}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {p.payment_method}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-slate-800">
                        {amountText}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <button
                          onClick={() => handlePrintReceipt(p.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Print Receipt"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
