import { useState, useCallback, useRef, useEffect } from "react";
import { Download, Search, Pencil, Trash2, X, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { downloadCsv } from "@/utils/downloadCsv";
import { useTenantLookup } from "@/hooks/useTenantLookup";
import { useTenantStatement } from "@/hooks/useReports";
import { putJson, deleteJson } from "@/utils/api";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";
import { SummaryCard } from "./SummaryCard";
import InvoiceDeleteButton from "@/components/InvoiceDeleteButton";

export function TenantStatementReport({
  userLoading,
  user,
  canViewReports,
  canManagePayments,
}) {
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editReceiptNumber, setEditReceiptNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const numericTenantId = selectedTenantId ? Number(selectedTenantId) : null;

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updatePaymentMutation = useMutation({
    mutationFn: async ({
      id,
      payment_date,
      amount,
      payment_method,
      reference_number,
      notes,
    }) => {
      return putJson(`/api/payments/${id}`, {
        payment_date,
        amount,
        payment_method,
        reference_number,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["reports", "tenantStatement", numericTenantId],
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });

      setEditingPayment(null);
      setActionError(null);
      setSuccessMessage("Payment updated successfully!");
    },
    onError: (err) => {
      console.error(err);
      setActionError(err?.message || "Could not update payment");
      setSuccessMessage(null);
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id) => {
      return deleteJson(`/api/payments/${id}`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["reports", "tenantStatement", numericTenantId],
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setActionError(null);
      setSuccessMessage(data?.message || "Payment deleted successfully");
    },
    onError: (err) => {
      console.error(err);
      setActionError(err?.message || "Could not delete payment");
      setSuccessMessage(null);
    },
  });

  const openEditPayment = useCallback((p) => {
    setActionError(null);
    setSuccessMessage(null);
    setEditingPayment(p);
    const dateText = p?.payment_date ? String(p.payment_date).slice(0, 10) : "";
    const amountValue = p?.invoice_amount_applied ?? p?.amount ?? "";
    setEditPaymentDate(dateText);
    setEditAmount(
      amountValue !== "" && amountValue !== null ? String(amountValue) : "",
    );
    setEditMethod(p?.payment_method || "Cash");
    setEditReceiptNumber(p?.reference_number || "");
    setEditNotes(p?.notes || "");
  }, []);

  const closeEditPayment = useCallback(() => {
    if (updatePaymentMutation.isPending) return;
    setEditingPayment(null);
    setActionError(null);
  }, [updatePaymentMutation.isPending]);

  const onSavePayment = useCallback(() => {
    if (!editingPayment) return;
    setActionError(null);
    setSuccessMessage(null);

    const amt = Number(editAmount);
    if (!editPaymentDate || !Number.isFinite(amt) || amt <= 0 || !editMethod) {
      setActionError("Please provide a valid date, method, and amount.");
      return;
    }

    updatePaymentMutation.mutate({
      id: editingPayment.id,
      payment_date: editPaymentDate,
      amount: amt,
      payment_method: editMethod,
      reference_number: editReceiptNumber || null,
      notes: editNotes || null,
    });
  }, [
    editingPayment,
    editPaymentDate,
    editAmount,
    editMethod,
    editReceiptNumber,
    editNotes,
    updatePaymentMutation,
  ]);

  const onDeletePayment = useCallback(
    (p) => {
      if (!p?.id) return;
      setActionError(null);
      setSuccessMessage(null);

      const invText = p.invoice_description
        ? ` (Invoice: ${p.invoice_description})`
        : "";
      const ok = window.confirm(
        `Delete this payment${invText}? This will reverse the payment and remove it from accounting.`,
      );
      if (!ok) return;

      deletePaymentMutation.mutate(p.id);
    },
    [deletePaymentMutation],
  );

  const handleInvoiceDeleted = useCallback(() => {
    // Refresh the tenant statement after invoice deletion
    queryClient.invalidateQueries({
      queryKey: ["reports", "tenantStatement", numericTenantId],
    });
    queryClient.invalidateQueries({
      queryKey: ["reports", "tenantLedger", numericTenantId],
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["accounting"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    setSuccessMessage("Invoice deleted successfully");
  }, [queryClient, numericTenantId]);

  const tenantLookupQuery = useTenantLookup(
    tenantSearch,
    !userLoading && !!user,
  );

  const tenantStatementQuery = useTenantStatement(
    numericTenantId,
    !userLoading && !!user && canViewReports,
  );

  const tenantOptions = tenantLookupQuery.data || [];

  const tenantStatement = tenantStatementQuery.data;
  const statementTenant = tenantStatement?.tenant || null;
  const statementPayments = tenantStatement?.payments || [];
  const statementLeases = tenantStatement?.leases || [];
  const statementInvoices = tenantStatement?.invoices || [];

  // STATEMENT TOTALS CALCULATION:
  // These totals include ALL invoice types for this tenant:
  // 1. Automatic monthly rent invoices (generated via cron)
  // 2. Manual invoices (created via Post Manual Invoice)
  // 3. Arrears invoices (created via Post Arrears)
  // All invoices contribute to the Debits, Credits, and Closing Balance.
  const totalsInvoiced = statementInvoices.reduce(
    (sum, inv) => sum + Number(inv.amount || 0),
    0,
  );

  const totalsPaid = statementPayments.reduce((sum, p) => {
    const applied = p.invoice_amount_applied;
    const amount = applied != null ? applied : p.amount;
    return sum + Number(amount || 0);
  }, 0);

  const totalsBalanceDue = statementInvoices.reduce(
    (sum, inv) => sum + Number(inv.outstanding || 0),
    0,
  );

  const onExportTenantPayments = useCallback(() => {
    if (!statementTenant) return;
    const safeName = String(statementTenant.full_name || "tenant").replaceAll(
      " ",
      "-",
    );
    const filename = `tenant-payments-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, statementPayments);
  }, [statementTenant, statementPayments]);

  const onExportTenantInvoices = useCallback(() => {
    if (!statementTenant) return;
    const safeName = String(statementTenant.full_name || "tenant").replaceAll(
      " ",
      "-",
    );
    const filename = `tenant-invoices-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, statementInvoices);
  }, [statementTenant, statementInvoices]);

  const isAnyActionPending =
    updatePaymentMutation.isPending || deletePaymentMutation.isPending;

  const onSelectTenant = useCallback((tenant) => {
    setSelectedTenantId(String(tenant.id));
    setTenantSearch("");
    setShowDropdown(false);
  }, []);

  return (
    <div
      ref={printRef}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Tenant statement
          </h2>
          <p className="text-sm text-slate-500">
            Invoices + payments + lease history
          </p>
        </div>
        <div
          className="flex flex-col sm:flex-row gap-2 sm:ml-auto"
          data-no-print="true"
        >
          <button
            onClick={onExportTenantInvoices}
            disabled={!statementTenant || statementInvoices.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export invoices CSV
          </button>
          <button
            onClick={onExportTenantPayments}
            disabled={!statementTenant || statementPayments.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export payments CSV
          </button>
          <PrintPreviewButtons targetRef={printRef} title="Tenant statement" />
        </div>
      </div>

      {successMessage ? (
        <div
          className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700"
          data-no-print="true"
        >
          {successMessage}
        </div>
      ) : null}

      {actionError ? (
        <div
          className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700"
          data-no-print="true"
        >
          {actionError}
        </div>
      ) : null}

      <div className="mb-4" data-no-print="true">
        <div className="relative" ref={searchRef}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={tenantSearch}
              onChange={(e) => {
                setTenantSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (tenantSearch.length > 0) setShowDropdown(true);
              }}
              placeholder="Search tenants by name, phone, or email..."
              className="w-full bg-transparent outline-none text-sm"
            />
            {tenantSearch && (
              <button
                onClick={() => {
                  setTenantSearch("");
                  setShowDropdown(false);
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && tenantSearch.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-[320px] overflow-auto">
              {tenantLookupQuery.isLoading ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  Searching...
                </div>
              ) : tenantOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No tenants found
                </div>
              ) : (
                tenantOptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTenant(t)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {t.full_name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {t.phone}
                        {t.email ? ` • ${t.email}` : ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Show selected tenant */}
        {selectedTenantId && statementTenant && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span className="text-sm font-medium">
              {statementTenant.full_name} ({statementTenant.phone})
            </span>
            <button
              onClick={() => {
                setSelectedTenantId("");
                setTenantSearch("");
              }}
              className="p-1 hover:bg-emerald-100 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {selectedTenantId ? (
        tenantStatementQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading statement…</p>
        ) : tenantStatementQuery.error ? (
          <p className="text-sm text-rose-600">
            Could not load tenant statement.
          </p>
        ) : (
          <div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Invoices
                </h3>
                {statementInvoices.length === 0 ? (
                  <p className="text-sm text-slate-500">No invoices.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                    {statementInvoices.map((inv) => {
                      const outstandingText = formatCurrencyUGX(
                        inv.outstanding,
                      );
                      const amountText = formatCurrencyUGX(inv.amount);
                      return (
                        <div
                          key={inv.id}
                          className="rounded-xl bg-white border border-gray-100 p-3"
                        >
                          <div className="font-medium text-slate-800">
                            {inv.description}
                          </div>
                          <div className="text-xs text-slate-500">
                            {inv.property_name} • Unit {inv.unit_number}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <div className="text-slate-600">
                              Amount: {amountText}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-slate-900">
                                Due: {outstandingText}
                              </div>
                              <InvoiceDeleteButton
                                invoiceId={inv.id}
                                onDeleted={handleInvoiceDeleted}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Payments
                </h3>
                {statementPayments.length === 0 ? (
                  <p className="text-sm text-slate-500">No payments.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        {/* Bold separator line between headers and first entry */}
                        <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Invoice</th>
                          <th className="py-2 pr-3">Method</th>
                          <th className="py-2 pr-3 text-right">Amount</th>
                          {canManagePayments ? (
                            <th
                              className="py-2 pr-3 text-right"
                              data-no-print="true"
                            >
                              Actions
                            </th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {statementPayments.map((p) => {
                          const dateText = String(p.payment_date).slice(0, 10);
                          const amountText = formatCurrencyUGX(
                            p.invoice_amount_applied || p.amount,
                          );
                          const isEditingThis = editingPayment?.id === p.id;

                          const editDisabled =
                            !canManagePayments || isAnyActionPending;
                          const deleteDisabled =
                            !canManagePayments || isAnyActionPending;

                          // Use composite key to handle payments with multiple allocations
                          // For upfront payments, invoice_id will be null/undefined
                          const rowKey = p.invoice_id
                            ? `payment-${p.id}-invoice-${p.invoice_id}`
                            : `payment-${p.id}-upfront`;

                          return (
                            <tr
                              key={rowKey}
                              className="border-b last:border-b-2 last:border-slate-700"
                            >
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {dateText}
                              </td>
                              <td className="py-2 pr-3">
                                {p.invoice_description || "Upfront"}
                              </td>
                              <td className="py-2 pr-3">{p.payment_method}</td>
                              <td className="py-2 pr-3 text-right font-medium text-slate-800">
                                {amountText}
                              </td>
                              {canManagePayments ? (
                                <td className="py-2 pr-3" data-no-print="true">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => openEditPayment(p)}
                                      disabled={editDisabled}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
                                      title={
                                        isEditingThis
                                          ? "Editing"
                                          : "Edit payment"
                                      }
                                    >
                                      <Pencil className="w-4 h-4" />
                                      <span className="text-xs">Edit</span>
                                    </button>
                                    <button
                                      onClick={() => onDeletePayment(p)}
                                      disabled={deleteDisabled}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-50"
                                      title="Delete payment"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span className="text-xs">Delete</span>
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!canManagePayments ? (
                      <div
                        className="mt-2 text-xs text-slate-500"
                        data-no-print="true"
                      >
                        You don't have permission to edit/delete payments.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Leases
                </h3>
                {statementLeases.length === 0 ? (
                  <p className="text-sm text-slate-500">No leases.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                    {statementLeases.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl bg-white border border-gray-100 p-3"
                      >
                        <div className="font-medium text-slate-800">
                          {l.property_name} • Unit {l.unit_number}
                        </div>
                        <div className="text-xs text-slate-500">
                          {String(l.start_date).slice(0, 10)} →{" "}
                          {String(l.end_date).slice(0, 10)}
                        </div>
                        <div className="text-sm text-slate-700 mt-1">
                          {l.currency} {Number(l.monthly_rent).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Totals summary at bottom (right-aligned) */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <SummaryCard
                label="Debits (UGX)"
                value={formatCurrencyUGX(totalsInvoiced)}
                align="right"
              />
              <SummaryCard
                label="Credits (UGX)"
                value={formatCurrencyUGX(totalsPaid)}
                align="right"
              />
              <SummaryCard
                label="Closing (UGX)"
                value={formatCurrencyUGX(totalsBalanceDue)}
                align="right"
              />
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-slate-500">
          Pick a tenant to view their statement.
        </div>
      )}

      {/* Edit payment modal */}
      {editingPayment ? (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center p-4"
          data-no-print="true"
        >
          <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Edit payment
                </div>
                <div className="text-xs text-slate-500">
                  {editingPayment.invoice_description
                    ? editingPayment.invoice_description
                    : "Payment"}
                </div>
              </div>
              <button
                onClick={closeEditPayment}
                className="p-2 rounded-md hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">
                    Payment date
                  </div>
                  <input
                    type="date"
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">
                    Amount (UGX)
                  </div>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">
                    Method
                  </div>
                  <select
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="MTN MoMo">MTN MoMo</option>
                    <option value="Airtel Money">Airtel Money</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">
                    Receipt # (optional)
                  </div>
                  <input
                    type="text"
                    value={editReceiptNumber}
                    onChange={(e) => setEditReceiptNumber(e.target.value)}
                    placeholder="e.g. RCT-001"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-xs font-medium text-slate-600">
                    Notes (optional)
                  </div>
                  <input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500">
                This will update the payment and its invoice allocation.
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={closeEditPayment}
                disabled={updatePaymentMutation.isPending}
                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onSavePayment}
                disabled={updatePaymentMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updatePaymentMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
