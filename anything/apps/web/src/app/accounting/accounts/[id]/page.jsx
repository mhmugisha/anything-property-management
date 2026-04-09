"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit2, Trash2, Save, X } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { fetchJson, putJson, deleteJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";
import DatePopoverInput from "@/components/DatePopoverInput";

export default function AccountStatementPage({ params }) {
  const accountId = params?.id;
  const printRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, [now]);
  const defaultTo = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  // Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editKind, setEditKind] = useState(null);
  const [activeRow, setActiveRow] = useState(null);
  const [formError, setFormError] = useState(null);

  // Generic form state
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentSource, setPaymentSource] = useState("bank");
  const [depositTo, setDepositTo] = useState("");

  // NEW: Fetch deposit accounts for the deposit edit form
  const depositAccountsQuery = useQuery({
    queryKey: ["accounting", "depositAccounts"],
    queryFn: async () => {
      const data = await fetchJson("/api/accounting/deposit-accounts");
      return data.accounts || [];
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  const depositAccounts = depositAccountsQuery.data || [];

  // Allow deep link from P&L: /accounting/accounts/:id?from=...&to=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qFrom = sp.get("from");
    const qTo = sp.get("to");
    if (qFrom) setFrom(qFrom);
    if (qTo) setTo(qTo);
  }, []);

  const statementQuery = useQuery({
    queryKey: ["accounting", "accountStatement", accountId, from, to],
    queryFn: async () => {
      const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      return fetchJson(`/api/accounting/accounts/${accountId}/statement?${qs}`);
    },
    enabled: !userLoading && !!user && canUseAccounting && !!accountId,
  });

  // NOTE: These must be defined before any early returns.
  const account = statementQuery.data?.account || null;
  const rows = statementQuery.data?.rows || [];
  const finalBalance = statementQuery.data?.finalBalance || 0;

  const debitTotal = rows.reduce((sum, r) => sum + Number(r?.debit || 0), 0);
  const creditTotal = rows.reduce((sum, r) => sum + Number(r?.credit || 0), 0);

  const debitTotalText = formatCurrencyUGX(debitTotal);
  const creditTotalText = formatCurrencyUGX(creditTotal);
  const finalBalanceText = formatCurrencyUGX(finalBalance);

  const isLoading = userLoading || staffQuery.isLoading;

  // Determine if this account supports edit/delete (Cash on Hand or Bank Account - Operating)
  const isEditableAccount =
    account &&
    (account.account_code === "1110" || account.account_code === "1120");

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditKind(null);
    setActiveRow(null);
    setFormError(null);
    setDate("");
    setDescription("");
    setReference("");
    setAmount("");
    setPaymentMethod("");
    setNotes("");
    setPaymentSource("bank");
    setDepositTo("");
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["accounting", "accountStatement"],
    });
    queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "trialBalance"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
    queryClient.invalidateQueries({ queryKey: ["accounting", "balanceSheet"] });
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
        return putJson(`/api/accounting/transactions/${activeRow.id}`, {
          transaction_date: date,
          description,
          reference_number: reference || null,
          amount: Number(amount),
          currency: "UGX",
        });
      }

      if (editKind === "payment") {
        return putJson(`/api/payments/${activeRow.source_id}`, {
          payment_date: date,
          amount: Number(amount),
          payment_method: paymentMethod,
          notes: notes || null,
        });
      }

      if (editKind === "landlord_payout") {
        return putJson(`/api/landlords/payouts/${activeRow.source_id}`, {
          payout_date: date,
          amount: Number(amount),
          payment_method: paymentMethod,
          reference_number: reference || null,
          notes: notes || null,
        });
      }

      if (editKind === "landlord_deduction") {
        return putJson(
          `/api/accounting/landlord-deductions/${activeRow.source_id}`,
          {
            deduction_date: date,
            description,
            amount: Number(amount),
            payment_source: paymentSource,
          },
        );
      }

      if (editKind === "tenant_deduction") {
        return putJson(
          `/api/accounting/tenant-deductions/${activeRow.source_id}`,
          {
            deduction_date: date,
            description,
            amount: Number(amount),
            payment_source: paymentSource,
          },
        );
      }

      // NEW: Handle deposit updates
      if (editKind === "deposit") {
        return putJson(`/api/accounting/deposits/${activeRow.source_id}`, {
          deposit_date: date,
          description,
          deposit_to_account_id: Number(depositTo),
        });
      }

      throw new Error(`Unknown edit kind: ${editKind}`);
    },
    onSuccess: () => {
      invalidateAll();
      closeModal();
    },
    onError: (err) => {
      console.error(err);
      setFormError(err?.message || "Could not save changes");
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

      // NEW: Handle deposit deletion
      if (kind === "deposit") {
        return deleteJson(`/api/accounting/deposits/${row.source_id}`);
      }

      throw new Error(`Unknown delete kind: ${kind}`);
    },
    onSuccess: () => {
      invalidateAll();
      closeModal();
    },
    onError: (err) => {
      console.error(err);
      setFormError(err?.message || "Could not delete");
    },
  });

  const openEdit = useCallback(async (row, kind) => {
    setFormError(null);
    setActiveRow(row);
    setEditKind(kind);
    setModalOpen(true);

    const toYmd = (d) => {
      if (!d) return "";
      const dt = new Date(d);
      return dt.toISOString().slice(0, 10);
    };

    // Prefill based on type
    if (kind === "manual") {
      setDate(toYmd(row.transaction_date));
      setDescription(row.description || "");
      setReference(row.reference_number || "");
      setAmount(row.amount != null ? String(row.amount) : "");
      return;
    }

    // For other kinds, fetch the source record
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
        return;
      }

      if (kind === "deposit") {
        const data = await fetchJson(
          `/api/accounting/deposits/${row.source_id}`,
        );
        const dep = data.deposit;
        setDate(toYmd(dep.transaction_date));
        setDescription(dep.description || "");
        setDepositTo(String(dep.debit_account_id || ""));
        return;
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

      deleteMutation.mutate({ row, kind });
    },
    [deleteMutation],
  );

  const rowsWithActions = useMemo(() => {
    if (!isEditableAccount) return rows;

    return rows.map((t) => {
      const sourceType = t.source_type || null;
      let kind = null;

      if (!sourceType) {
        const desc = String(t.description || "");
        const isSystemLike =
          desc.startsWith("Rent collection -") ||
          desc.startsWith("Commission -") ||
          desc.startsWith("Landlord payout -") ||
          desc.startsWith("Landlord deduction -") ||
          desc.startsWith("Tenant deduction -");

        kind = isSystemLike ? null : "manual";
        return { ...t, _editKind: kind };
      }

      if (sourceType === "manual") {
        kind = "manual";
      } else if (sourceType === "payment") {
        const isReceipt = t.debit > 0;
        kind = isReceipt ? "payment" : null;
      } else if (sourceType === "landlord_payout") {
        kind = "landlord_payout";
      } else if (sourceType === "landlord_deduction") {
        kind = "landlord_deduction";
      } else if (sourceType === "tenant_deduction") {
        kind = "tenant_deduction";
      } else if (sourceType === "deposit") {
        // For deposits, source_id should be the transaction's own ID
        // Use t.id to ensure we always have a valid ID even for older deposits
        kind = "deposit";
        return { ...t, _editKind: kind, source_id: t.id };
      }

      return { ...t, _editKind: kind };
    });
  }, [rows, isEditableAccount]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
    return null;
  }

  if (!staffQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/onboarding";
    return null;
  }

  if (!canUseAccounting) {
    return (
      <AccessDenied
        title="Accounting"
        message="You don't have access to the accounting module."
      />
    );
  }

  const pageTitle = account
    ? `Account Statement: ${account.account_code} ${account.account_name}`
    : "Account Statement";

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Account Statement"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div ref={printRef} className="p-4 md:p-6 space-y-2">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mt-2">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                {pageTitle}
              </h1>
              {account ? (
                <p className="text-slate-500">Type: {account.account_type}</p>
              ) : null}
            </div>

            <div className="sm:ml-auto" data-no-print="true">
              <PrintPreviewButtons targetRef={printRef} title={pageTitle} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                />
              </Field>
              <div className="text-xs text-slate-500 flex items-end">
                Running balance is shown in the Balance column.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            {statementQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading statement…</p>
            ) : statementQuery.error ? (
              <p className="text-sm text-rose-600">Could not load statement.</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">No transactions found.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    {/* Bold separator line between headers and first entry */}
                    <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3 text-right">Debit (UGX)</th>
                      <th className="py-2 pr-3 text-right">Credit (UGX)</th>
                      <th className="py-2 pr-3 text-right">Balance (UGX)</th>
                      <th className="py-2 pr-3">Created By</th>
                      {isEditableAccount ? (
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
                    {rowsWithActions.map((r) => {
                      const dateText = String(r.transaction_date).slice(0, 10);
                      const debitText = r.debit
                        ? formatCurrencyUGX(r.debit)
                        : "—";
                      const creditText = r.credit
                        ? formatCurrencyUGX(r.credit)
                        : "—";
                      const balanceText = formatCurrencyUGX(r.balance);

                      const canEdit = isEditableAccount && !!r._editKind;

                      return (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {dateText}
                          </td>
                          <td className="py-2 pr-3">{r.description}</td>
                          <td className="py-2 pr-3 text-right">{debitText}</td>
                          <td className="py-2 pr-3 text-right">{creditText}</td>
                          <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                            {balanceText}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">
                            {r.created_by_name || "—"}
                          </td>
                          {isEditableAccount ? (
                            <td
                              className="py-2 pr-3 text-right"
                              data-no-print="true"
                            >
                              {canEdit ? (
                                <div className="inline-flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => openEdit(r, r._editKind)}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => openDelete(r, r._editKind)}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  —
                                </span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {/* Bold separator line above totals */}
                    <tr className="border-t-2 border-slate-700">
                      <td className="py-2 pr-3" />
                      <td className="py-2 pr-3 font-semibold text-slate-700">
                        All-Time Totals
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                        {debitTotalText}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                        {creditTotalText}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                        {finalBalanceText}
                      </td>
                      <td className="py-2 pr-3 text-slate-400">—</td>
                      {isEditableAccount ? <td className="py-2 pr-3" /> : null}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit modal */}
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
                          : editKind === "deposit"
                            ? "Edit deposit"
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
                  <div className="md:col-span-2">
                    <Field label="Description">
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                      />
                    </Field>
                  </div>
                  <Field label="Reference (optional)">
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    />
                  </Field>
                </div>
              ) : null}

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
                      <option value="Bank Account - Operating">
                        Bank Account - Operating
                      </option>
                      <option value="Cash on Hand">Cash on Hand</option>
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
                </div>
              ) : null}

              {/* NEW: Deposit edit form */}
              {editKind === "deposit" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Date">
                    <DatePopoverInput
                      value={date}
                      onChange={setDate}
                      placeholder="DD-MM-YYYY"
                      className="bg-white"
                    />
                  </Field>
                  <Field label="Deposit to">
                    <select
                      value={depositTo}
                      onChange={(e) => setDepositTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    >
                      <option value="">Select account…</option>
                      {depositAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}
