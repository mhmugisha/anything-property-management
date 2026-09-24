"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { Field } from "@/components/Accounting/Field";
import { postJson } from "@/utils/api";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";

const HOLDING_CODE = "2500";
const DEFAULT_DEBIT_CODE = "1120";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceiveToHoldingPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const queryClient = useQueryClient();

  const accountRegistry = useAccountRegistry(
    !userLoading && !!user && canUseAccounting,
  );
  const accounts = accountRegistry.accounts || [];

  const holdingAccount = useMemo(
    () => accounts.find((a) => String(a.account_code) === HOLDING_CODE) || null,
    [accounts],
  );

  const bankOptions = useMemo(() => {
    return accounts
      .filter(
        (a) =>
          a.is_active !== false &&
          a.account_type === "Asset" &&
          a.is_cash_bank === true,
      )
      .map((a) => ({
        id: a.id,
        code: a.account_code,
        name: a.account_name,
        label: `${a.account_code} • ${a.account_name}`,
      }));
  }, [accounts]);

  const [transactionDate, setTransactionDate] = useState(todayYmd);
  const [debitAccountId, setDebitAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (debitAccountId) return;
    if (bankOptions.length === 0) return;
    const preferred = bankOptions.find((o) => o.code === DEFAULT_DEBIT_CODE);
    setDebitAccountId(String((preferred || bankOptions[0]).id));
  }, [bankOptions, debitAccountId]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const createMutation = useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/transactions", payload),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["accounting", "holdingUnallocated"],
      });
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "trialBalance"],
      });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
      setSuccessMessage(
        `Parked ${formatCurrencyUGX(vars?.amount || 0)} in Holding.`,
      );
      setAmount("");
      setReferenceNumber("");
      setDescription("");
      setTransactionDate(todayYmd());
    },
  });

  const parsedAmount = Number(amount);
  const canSubmit =
    !!holdingAccount &&
    !!debitAccountId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(transactionDate);

  const onSubmit = useCallback(() => {
    if (!canSubmit) return;
    createMutation.reset();
    const payload = {
      transaction_date: transactionDate,
      description: description.trim() || "Receive to Holding",
      reference_number: referenceNumber.trim() || null,
      debit_account_id: Number(debitAccountId),
      credit_account_id: Number(holdingAccount.id),
      amount: parsedAmount,
      currency: "UGX",
    };
    createMutation.mutate(payload);
  }, [
    canSubmit,
    createMutation,
    transactionDate,
    description,
    referenceNumber,
    debitAccountId,
    holdingAccount,
    parsedAmount,
  ]);

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
        title="Receive to Holding"
        message="You don't have access to the accounting module."
      />
    );
  }

  const accountsLoading =
    accountRegistry.isHydrating || accountRegistry.query.isLoading;
  const accountsError = accountRegistry.query.error;
  const noBankAccounts = !accountsLoading && bankOptions.length === 0;
  const missingHolding = !accountsLoading && !holdingAccount;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Receive to Holding"
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
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Receive to Holding
            </h1>
            <p className="text-slate-500">
              Park money that has arrived (bank or cash) but isn't yet matched
              to a tenant. Debits the chosen bank/cash account and credits
              Holding (2500). Clear it later from Allocate Payment.
            </p>
          </div>

          {successMessage ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-medium">
              {successMessage}
            </div>
          ) : null}

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 max-w-[720px]">
            {accountsError ? (
              <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                Could not load accounts.
              </div>
            ) : null}

            {missingHolding ? (
              <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                Holding account (2500) not found in the Chart of Accounts.
              </div>
            ) : null}

            {noBankAccounts && !missingHolding ? (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                No bank/cash accounts tagged yet — tag one in{" "}
                <a
                  href="/accounting/chart-of-accounts"
                  className="underline font-medium"
                >
                  Chart of Accounts
                </a>
                .
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Date">
                <DatePopoverInput
                  value={transactionDate}
                  onChange={setTransactionDate}
                  placeholder="DD-MM-YYYY"
                  className="bg-gray-50"
                />
              </Field>

              <Field label="Amount (UGX)">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                />
              </Field>

              <Field label="Debit (received into)">
                <select
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                  disabled={bankOptions.length === 0}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none disabled:opacity-60"
                >
                  {bankOptions.length === 0 ? (
                    <option value="">No bank/cash accounts</option>
                  ) : null}
                  {bankOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Credit (locked)">
                <input
                  value={
                    holdingAccount
                      ? `${holdingAccount.account_code} • ${holdingAccount.account_name}`
                      : `${HOLDING_CODE} • Holding`
                  }
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none text-slate-700"
                />
              </Field>

              <Field label="Reference number (bank / MoMo)">
                <input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. FT2504110000123"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                />
              </Field>

              <Field label="Description (optional)">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Cash drop from Ntinda site"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                />
              </Field>
            </div>

            {createMutation.error ? (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                {createMutation.error?.message ||
                  "Could not park entry to Holding."}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit || createMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : "Park to Holding"}
              </button>
              <a
                href="/accounting/allocate-payment"
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Go to Allocate Payment →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
