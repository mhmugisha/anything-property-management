"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Save } from "lucide-react";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { postJson } from "@/utils/api";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";

function Field({ label, children, error }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {children}
      {error ? <div className="text-xs text-rose-600">{error}</div> : null}
    </div>
  );
}

export default function TransferFundsPage() {
  const queryClient = useQueryClient();

  // Use account registry to get chart of accounts
  const accountRegistry = useAccountRegistry(true);
  const accounts = accountRegistry.accounts || [];

  // Create account options from active accounts
  const accountOptions = useMemo(() => {
    const activeAccounts = accounts.filter((a) => a.is_active !== false);
    return activeAccounts.map((a) => {
      const label = `${a.account_code} • ${a.account_name}`;
      return { id: a.id, label, type: a.account_type };
    });
  }, [accounts]);

  const isLoading = accountRegistry.query.isLoading;

  const [transferDate, setTransferDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");

  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const transferMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFieldErrors({});

      // Client-side validation
      const errors = {};
      if (!transferDate) errors.transferDate = "Date is required";
      if (!amount || Number(amount) <= 0)
        errors.amount = "Amount must be greater than 0";
      if (!description.trim()) errors.description = "Description is required";
      if (!fromAccountId) errors.fromAccountId = "Source account is required";
      if (!toAccountId) errors.toAccountId = "Destination account is required";
      if (fromAccountId === toAccountId) {
        errors.toAccountId = "Cannot transfer to the same account";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        throw new Error("Please fix the errors above");
      }

      const payload = {
        transfer_date: transferDate,
        amount: Number(amount),
        description: description.trim(),
        from_account_id: Number(fromAccountId),
        to_account_id: Number(toAccountId),
      };

      return postJson("/api/accounting/transfers", payload);
    },
    onSuccess: (data) => {
      // Invalidate all accounting queries to refresh balances
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      // Navigate back to accounting page
      if (typeof window !== "undefined") {
        window.location.href = "/accounting";
      }
    },
    onError: (err) => {
      console.error(err);
      setFormError(err?.message || "Failed to complete transfer");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    transferMutation.mutate();
  };

  const handleCancel = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/accounting";
    }
  };

  // Get account details for preview
  const fromAccount = accountOptions.find(
    (a) => a.id === Number(fromAccountId),
  );
  const toAccount = accountOptions.find((a) => a.id === Number(toAccountId));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowRightLeft className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Transfer Funds
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            Transfer money between accounts with proper accounting entries
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {formError ? (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Transfer Date" error={fieldErrors.transferDate}>
                <DatePopoverInput
                  value={transferDate}
                  onChange={setTransferDate}
                  placeholder="DD-MM-YYYY"
                  className="bg-white"
                />
              </Field>

              <Field label="Amount (UGX)" error={fieldErrors.amount}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>

            <Field label="Description" error={fieldErrors.description}>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Transfer to bank for operating expenses"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="From Account (Source)"
                error={fieldErrors.fromAccountId}
              >
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select source account...</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="To Account (Destination)"
                error={fieldErrors.toAccountId}
              >
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select destination account...</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Transfer Preview */}
            {fromAccount && toAccount && amount && Number(amount) > 0 ? (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-semibold text-blue-900 mb-3">
                  Transfer Summary
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">From:</span>
                    <span className="font-medium text-slate-900">
                      {fromAccount.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">To:</span>
                    <span className="font-medium text-slate-900">
                      {toAccount.label}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 pt-2">
                    <span className="text-slate-600">Amount:</span>
                    <span className="font-bold text-blue-900">
                      {formatCurrencyUGX(Number(amount))}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleCancel}
                disabled={transferMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transferMutation.isPending || isLoading}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {transferMutation.isPending
                  ? "Processing..."
                  : "Complete Transfer"}
              </button>
            </div>
          </form>

          {/* Info Note */}
          <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-600">
              <strong>Note:</strong> This transfer will create a transaction
              that debits the destination account and credits the source
              account. Both accounts will show this transaction in their
              ledgers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
