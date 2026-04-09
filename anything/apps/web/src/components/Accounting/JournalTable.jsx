import { useCallback, useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit2, Trash2, X, Save, Undo2 } from "lucide-react";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { deleteJson, fetchJson, putJson } from "@/utils/api";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatDate } from "@/utils/formatters";
import Pagination from "@/components/Pagination";

function toYmd(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}

export function JournalTable({
  transactions,
  isLoading,
  error,
  accountOptions,
}) {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 14;

  const [modalOpen, setModalOpen] = useState(false);
  const [editKind, setEditKind] = useState(null);
  const [activeRow, setActiveRow] = useState(null);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Generic form state (we only show what is relevant per kind)
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [amount, setAmount] = useState("");

  // Payment-specific
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  // Deduction source
  const [paymentSource, setPaymentSource] = useState("bank");

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditKind(null);
    setActiveRow(null);
    setFormError(null);
    // Don't clear success message here - let it auto-dismiss
    setDate("");
    setDescription("");
    setReference("");
    setDebitAccountId("");
    setCreditAccountId("");
    setAmount("");
    setPaymentMethod("");
    setNotes("");
    setPaymentSource("bank");
  }, []);

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "trialBalance"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "balanceSheet"] });
    queryClient.invalidateQueries({
      queryKey: ["accounting", "undepositedFunds"],
    });
    queryClient.invalidateQueries({
      queryKey: ["accounting", "recentDeposits"],
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeRow || !editKind) {
        throw new Error("No row selected");
      }

      setFormError(null);

      if (editKind === "manual") {
        const payload = {
          transaction_date: date,
          description,
          reference_number: reference || null,
          debit_account_id: Number(debitAccountId),
          credit_account_id: Number(creditAccountId),
          amount: Number(amount),
          currency: "UGX",
        };
        return putJson(`/api/accounting/transactions/${activeRow.id}`, payload);
      }

      if (editKind === "payment") {
        const payload = {
          payment_date: date,
          amount: Number(amount),
          payment_method: paymentMethod,
          notes: notes || null,
        };
        return putJson(`/api/payments/${activeRow.source_id}`, payload);
      }

      if (editKind === "landlord_payout") {
        const payload = {
          payout_date: date,
          amount: Number(amount),
          payment_method: paymentMethod,
          reference_number: reference || null,
          notes: notes || null,
        };
        return putJson(
          `/api/landlords/payouts/${activeRow.source_id}`,
          payload,
        );
      }

      if (editKind === "landlord_deduction") {
        const payload = {
          deduction_date: date,
          description,
          amount: Number(amount),
          payment_source: paymentSource,
        };
        return putJson(
          `/api/accounting/landlord-deductions/${activeRow.source_id}`,
          payload,
        );
      }

      if (editKind === "tenant_deduction") {
        const payload = {
          deduction_date: date,
          description,
          amount: Number(amount),
          payment_source: paymentSource,
        };
        return putJson(
          `/api/accounting/tenant-deductions/${activeRow.source_id}`,
          payload,
        );
      }

      throw new Error(`Unknown edit kind: ${editKind}`);
    },
    onSuccess: (data) => {
      invalidateAll();
      closeModal();
      setFormError(null);
      setSuccessMessage(data?.message || "Payment updated.");
    },
    onError: (err) => {
      console.error(err);
      setFormError(err?.message || "Could not save changes");
      setSuccessMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ row, kind }) => {
      if (!row || !kind) {
        throw new Error("No row selected");
      }

      if (kind === "manual") {
        return deleteJson(`/api/accounting/transactions/${row.id}`);
      }

      if (kind === "payment") {
        return deleteJson(`/api/payments/${row.source_id}`);
      }

      if (kind === "landlord_payout") {
        return deleteJson(`/api/landlords/payouts/${row.source_id}`);
      }

      if (kind === "landlord_deduction") {
        return deleteJson(
          `/api/accounting/landlord-deductions/${row.source_id}`,
        );
      }

      if (kind === "tenant_deduction") {
        return deleteJson(`/api/accounting/tenant-deductions/${row.source_id}`);
      }

      throw new Error(`Unknown delete kind: ${kind}`);
    },
    onSuccess: (data) => {
      invalidateAll();
      // If the modal was open for editing, close it.
      closeModal();
      setFormError(null);
      setSuccessMessage(data?.message || "Payment deleted.");
    },
    onError: (err) => {
      console.error(err);
      setFormError(err?.message || "Could not delete");
      setSuccessMessage(null);
    },
  });

  // NEW: Reverse deposit mutation
  const reverseDepositMutation = useMutation({
    mutationFn: async (depositId) => {
      return deleteJson(`/api/accounting/deposits/${depositId}`);
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err) => {
      console.error(err);
      setFormError(err?.message || "Could not reverse deposit");
    },
  });

  const handleReverseDeposit = useCallback(
    (depositId, description) => {
      if (typeof window !== "undefined") {
        const ok = window.confirm(
          `Reverse deposit "${description}"?\n\nThis will move all payments from this deposit back to Undeposited Funds. This action cannot be undone.`,
        );
        if (!ok) return;
      }
      reverseDepositMutation.mutate(depositId);
    },
    [reverseDepositMutation],
  );

  const openEdit = useCallback(async (row, kind) => {
    setFormError(null);
    setActiveRow(row);
    setEditKind(kind);
    setModalOpen(true);

    // Prefill based on type
    if (kind === "manual") {
      setDate(toYmd(row.transaction_date));
      setDescription(row.description || "");
      setReference(row.reference_number || "");
      setDebitAccountId(
        row.debit_account_id ? String(row.debit_account_id) : "",
      );
      setCreditAccountId(
        row.credit_account_id ? String(row.credit_account_id) : "",
      );
      setAmount(row.amount != null ? String(row.amount) : "");
      return;
    }

    // For other kinds, fetch the source record so the form is accurate.
    try {
      if (kind === "payment") {
        const data = await fetchJson(`/api/payments/${row.source_id}`);
        const p = data.payment;
        setDate(toYmd(p.payment_date));
        setAmount(p.amount != null ? String(p.amount) : "");
        setPaymentMethod(p.payment_method || "");
        setNotes(p.notes || "");
        return;
      }

      if (kind === "landlord_payout") {
        const data = await fetchJson(`/api/landlords/payouts/${row.source_id}`);
        const p = data.payout;
        setDate(toYmd(p.payout_date));
        setAmount(p.amount != null ? String(p.amount) : "");
        setPaymentMethod(p.payment_method || "");
        setReference(p.reference_number || "");
        setNotes(p.notes || "");
        return;
      }

      if (kind === "landlord_deduction") {
        const data = await fetchJson(
          `/api/accounting/landlord-deductions/${row.source_id}`,
        );
        const d = data.deduction;
        setDate(toYmd(d.deduction_date));
        setDescription(d.description || "");
        setAmount(d.amount != null ? String(d.amount) : "");
        // We can't reliably infer bank vs cash from old data; default to bank.
        setPaymentSource("bank");
        return;
      }

      if (kind === "tenant_deduction") {
        const data = await fetchJson(
          `/api/accounting/tenant-deductions/${row.source_id}`,
        );
        const d = data.deduction;
        setDate(toYmd(d.deduction_date));
        setDescription(d.description || "");
        setAmount(d.amount != null ? String(d.amount) : "");
        setPaymentSource("bank");
      }
    } catch (err) {
      console.error(err);
      setFormError(err?.message || "Could not load record for editing");
    }
  }, []);

  const openDelete = useCallback(
    (row, kind) => {
      if (typeof window !== "undefined") {
        const ok = window.confirm(
          "Delete this transaction? This cannot be undone.",
        );
        if (!ok) return;
      }

      // If user deletes from the table, don't depend on async state updates.
      deleteMutation.mutate({ row, kind });
    },
    [deleteMutation],
  );

  const rowsWithActions = useMemo(() => {
    return transactions.map((t) => {
      const sourceType = t.source_type || null;
      let kind = null;

      if (!sourceType) {
        // Older data before we added source tracking.
        // If it looks system-generated, lock it to avoid desync.
        const desc = String(t.description || "");
        const isSystemLike =
          desc.startsWith("Rent collection -") ||
          desc.startsWith("Commission -") ||
          desc.startsWith("Landlord payout -") ||
          desc.startsWith("Landlord deduction -") ||
          desc.startsWith("Tenant deduction -");

        kind = isSystemLike ? null : "manual";
        return { ...t, _editKind: kind, _isDeposit: false };
      }

      // NEW: Mark deposit transactions
      if (sourceType === "deposit") {
        return { ...t, _editKind: null, _isDeposit: true };
      }

      if (sourceType === "manual") {
        kind = "manual";
      } else if (sourceType === "payment") {
        // Only show actions on the receipt row, not the commission row.
        const isReceipt = String(t.debit_code) === "1130";
        kind = isReceipt ? "payment" : null;
      } else if (sourceType === "landlord_payout") {
        kind = "landlord_payout";
      } else if (sourceType === "landlord_deduction") {
        kind = "landlord_deduction";
      } else if (sourceType === "tenant_deduction") {
        kind = "tenant_deduction";
      }

      return { ...t, _editKind: kind, _isDeposit: false };
    });
  }, [transactions]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return rowsWithActions.slice(startIndex, endIndex);
  }, [rowsWithActions, currentPage]);

  const totalPages = Math.ceil(rowsWithActions.length / itemsPerPage);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading journal…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">Could not load journal.</p>;
  }

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No entries in the selected range.
      </p>
    );
  }

  return (
    <>
      {successMessage ? (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {formError && !modalOpen ? (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {formError}
        </div>
      ) : null}

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Debit</th>
              <th className="py-2 pr-3">Credit</th>
              <th className="py-2 pr-3 text-right">Amount (UGX)</th>
              <th className="py-2 pr-3">Created By</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((t) => {
              const debitText = t.debit_code
                ? `${t.debit_code} ${t.debit_name}`
                : "—";
              const creditText = t.credit_code
                ? `${t.credit_code} ${t.credit_name}`
                : "—";
              const amountText = formatCurrencyUGX(t.amount);
              const dateText = formatDate(t.transaction_date);

              const canEdit = !!t._editKind;
              const isDeposit = t._isDeposit;

              return (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{dateText}</td>
                  <td className="py-2 pr-3">{t.description}</td>
                  <td className="py-2 pr-3">{debitText}</td>
                  <td className="py-2 pr-3">{creditText}</td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-800">
                    {amountText}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {t.created_by_name || "—"}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {isDeposit ? (
                      <button
                        onClick={() =>
                          handleReverseDeposit(t.id, t.description)
                        }
                        disabled={reverseDepositMutation.isPending}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-50"
                        title="Reverse deposit - moves all payments back to Undeposited Funds"
                      >
                        <Undo2 className="w-4 h-4" />
                        Reverse
                      </button>
                    ) : canEdit ? (
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(t, t._editKind)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => openDelete(t, t._editKind)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
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

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold text-slate-800">
                {editKind === "manual"
                  ? "Edit transaction"
                  : editKind === "payment"
                    ? "Edit payment"
                    : editKind === "landlord_payout"
                      ? "Edit payout"
                      : editKind === "landlord_deduction"
                        ? "Edit landlord deduction"
                        : editKind === "tenant_deduction"
                          ? "Edit tenant deduction"
                          : "Edit"}
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {formError ? (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              {/* Manual transaction fields */}
              {editKind === "manual" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Date">
                    <DatePopoverInput
                      value={date}
                      onChange={setDate}
                      placeholder="DD-MM-YYYY"
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Amount (UGX)">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <Field label="Reference (optional)">
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <Field label="Debit account">
                    <select
                      value={debitAccountId}
                      onChange={(e) => setDebitAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    >
                      <option value="">Select…</option>
                      {(accountOptions || []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Credit account">
                    <select
                      value={creditAccountId}
                      onChange={(e) => setCreditAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    >
                      <option value="">Select…</option>
                      {(accountOptions || []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}

              {/* Payment */}
              {editKind === "payment" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Payment date">
                    <DatePopoverInput
                      value={date}
                      onChange={setDate}
                      placeholder="DD-MM-YYYY"
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Amount (UGX)">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <Field label="Method">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="MTN MoMo">MTN MoMo</option>
                      <option value="Airtel Money">Airtel Money</option>
                    </select>
                  </Field>
                  <Field label="Notes (optional)">
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                </div>
              ) : null}

              {/* Payout */}
              {editKind === "landlord_payout" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Payout date">
                    <DatePopoverInput
                      value={date}
                      onChange={setDate}
                      placeholder="DD-MM-YYYY"
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Amount (UGX)">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <Field label="Method">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="MTN MoMo">MTN MoMo</option>
                      <option value="Airtel Money">Airtel Money</option>
                    </select>
                  </Field>
                  <Field label="Reference (optional)">
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Notes (optional)">
                      <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {/* Deductions */}
              {editKind === "landlord_deduction" ||
              editKind === "tenant_deduction" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Date">
                    <DatePopoverInput
                      value={date}
                      onChange={setDate}
                      placeholder="DD-MM-YYYY"
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Amount (UGX)">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Description">
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                      />
                    </Field>
                  </div>
                  <Field label="Paid from">
                    <select
                      value={paymentSource}
                      onChange={(e) => setPaymentSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    >
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </Field>
                  <div className="md:col-span-1" />
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !editKind}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Tip: for rent payments, edit/delete is shown on the main "Rent
                collection" row.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
