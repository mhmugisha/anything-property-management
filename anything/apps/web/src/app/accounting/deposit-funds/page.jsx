"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { fetchJson, postJson } from "@/utils/api";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatDate } from "@/utils/formatters";
import { formatCurrencyUGX } from "@/utils/formatCurrency";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function DepositFundsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const queryClient = useQueryClient();

  const undepositedQuery = useQuery({
    queryKey: ["accounting", "undepositedFunds"],
    queryFn: async () => {
      const data = await fetchJson("/api/accounting/undeposited-funds");
      return data.payments || [];
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  const depositAccountsQuery = useQuery({
    queryKey: ["accounting", "depositAccounts"],
    queryFn: async () => {
      const data = await fetchJson("/api/accounting/deposit-accounts");
      return data.accounts || [];
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  const [depositDate, setDepositDate] = useState(todayYmd);
  const [depositDescription, setDepositDescription] = useState("Bank deposit");
  const [depositDescriptionTouched, setDepositDescriptionTouched] =
    useState(false);
  const [depositTo, setDepositTo] = useState("");

  const [selected, setSelected] = useState(() => new Set());

  const payments = undepositedQuery.data || [];
  const depositAccounts = depositAccountsQuery.data || [];

  const paymentCountText = useMemo(() => {
    const n = payments.length;
    const suffix = n === 1 ? "" : "s";
    return `${n} payment${suffix}`;
  }, [payments.length]);

  const selectedIds = useMemo(() => Array.from(selected.values()), [selected]);

  useEffect(() => {
    if (depositDescriptionTouched) {
      return;
    }

    if (selectedIds.length === 0) {
      setDepositDescription("Bank deposit");
      return;
    }

    const selectedPayments = payments.filter((p) => selected.has(Number(p.id)));

    const descriptions = selectedPayments
      .map((p) => String(p.description || p.invoice_description || "").trim())
      .filter(Boolean);

    const uniqueDescriptions = Array.from(new Set(descriptions));

    if (uniqueDescriptions.length === 1) {
      setDepositDescription(uniqueDescriptions[0]);
      return;
    }

    const invoiceDescs = selectedPayments
      .map((p) => String(p.invoice_description || "").trim())
      .filter(Boolean);
    const uniqueInvoiceDescs = Array.from(new Set(invoiceDescs));

    if (uniqueInvoiceDescs.length === 1) {
      setDepositDescription(
        `Rent collection - Multiple tenants - ${uniqueInvoiceDescs[0]}`,
      );
      return;
    }

    setDepositDescription(
      "Rent collection - Multiple tenants - Multiple periods",
    );
  }, [depositDescriptionTouched, payments, selected, selectedIds]);

  const selectedTotal = useMemo(() => {
    const byId = new Map(
      payments.map((p) => [Number(p.id), Number(p.amount || 0)]),
    );
    let total = 0;
    for (const id of selectedIds) {
      total += byId.get(Number(id)) || 0;
    }
    return total;
  }, [payments, selectedIds]);

  const selectedTotalText = useMemo(() => {
    return formatCurrencyUGX(selectedTotal);
  }, [selectedTotal]);

  const undepositedTotal = useMemo(() => {
    let total = 0;
    for (const p of payments) {
      total += Number(p.amount || 0);
    }
    return total;
  }, [payments]);

  const undepositedTotalText = useMemo(() => {
    return formatCurrencyUGX(undepositedTotal);
  }, [undepositedTotal]);

  const depositMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        deposit_date: depositDate,
        description: depositDescription,
        deposit_to_account_id: depositTo ? Number(depositTo) : null,
        transaction_ids: selectedIds.map((x) => Number(x)),
      };
      return postJson("/api/accounting/deposits", payload);
    },
    onSuccess: () => {
      setSelected(new Set());
      setDepositDescriptionTouched(false);
      queryClient.invalidateQueries({
        queryKey: ["accounting", "undepositedFunds"],
      });
      queryClient.invalidateQueries({ queryKey: ["accounting", "deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "accountStatement"],
      });
    },
  });

  const depositErrorText = useMemo(() => {
    if (!depositMutation.error) return null;
    return String(depositMutation.error?.message || "Could not save deposit");
  }, [depositMutation.error]);

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = Number(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allChecked = payments.length > 0 && selected.size === payments.length;

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set();
      if (payments.length === 0) return next;

      const shouldCheckAll = !(prev.size === payments.length);
      if (!shouldCheckAll) return next;

      for (const p of payments) next.add(Number(p.id));
      return next;
    });
  }, [payments]);

  const isLoading = userLoading || staffQuery.isLoading;

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
        title="Deposit funds"
        message="You don't have access to the accounting module."
      />
    );
  }

  const canSave =
    !!depositDate &&
    !!depositDescription &&
    !!depositTo &&
    selectedIds.length > 0 &&
    selectedTotal > 0;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Deposit funds"
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
        <div className="max-w-[90%] mx-auto p-4 md:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Deposit funds
              </h1>
              <p className="text-slate-500">
                Select undeposited payments, then save one bank/cash deposit.
              </p>
            </div>
          </div>

          {/* Bank deposit form */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Bank deposit
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Date">
                <DatePopoverInput
                  value={depositDate}
                  onChange={setDepositDate}
                  placeholder="DD-MM-YYYY"
                  className="bg-gray-50"
                />
              </Field>

              <Field label="Description">
                <input
                  value={depositDescription}
                  onChange={(e) => {
                    setDepositDescriptionTouched(true);
                    setDepositDescription(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  placeholder="e.g. Deposit to Stanbic"
                />
              </Field>

              <Field label="Amount deposited (UGX)">
                <input
                  value={selectedTotalText}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none"
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  This totals all the checked payments below.
                </div>
              </Field>

              <Field label="Deposit to">
                <select
                  value={depositTo}
                  onChange={(e) => setDepositTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                >
                  <option value="">Select account…</option>
                  {depositAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {depositErrorText ? (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                {depositErrorText}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => depositMutation.mutate()}
                  disabled={depositMutation.isPending || !canSave}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {depositMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setSelected(new Set());
                    setDepositDescriptionTouched(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Clear selection
                </button>
              </div>

              <div className="md:w-[260px]">
                <Field label="Total undeposited (UGX)">
                  <input
                    value={undepositedTotalText}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Accounting effect: Debit the selected bank/cash account, Credit
              Undeposited Funds (1130).
            </div>
          </div>

          {/* Undeposited list */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Undeposited funds
              </h2>
              <div className="text-sm text-slate-500">{paymentCountText}</div>
            </div>

            {undepositedQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : undepositedQuery.error ? (
              <p className="text-sm text-rose-600">
                Could not load undeposited funds.
              </p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-slate-500">No undeposited funds.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-3 w-10">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Tenant</th>
                      <th className="py-2 pr-3">Property</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3 text-right">Amount (UGX)</th>
                      <th className="py-2 pr-3">Created by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const id = Number(p.id);
                      const checked = selected.has(id);
                      const dateText = formatDate(p.payment_date);
                      const amountText = formatCurrencyUGX(p.amount);
                      const descText =
                        p.description || p.invoice_description || "—";
                      const createdByText = p.created_by_name || "—";

                      return (
                        <tr key={id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(id)}
                            />
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {dateText}
                          </td>
                          <td className="py-2 pr-3">{p.tenant_name || "—"}</td>
                          <td className="py-2 pr-3">
                            {p.property_name || "—"}
                          </td>
                          <td className="py-2 pr-3">{descText}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {p.payment_method}
                          </td>
                          <td className="py-2 pr-3 text-right font-medium text-slate-800">
                            {amountText}
                          </td>
                          <td className="py-2 pr-3">{createdByText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 text-xs text-slate-500">
              Newest entries are shown at the bottom.
            </div>
          </div>
        </div>
      </main>
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
