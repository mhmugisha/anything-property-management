"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Save, Trash2, Copy, Plus } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import MoneyInput from "@/components/MoneyInput";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { fetchJson, postJson, putJson, deleteJson } from "@/utils/api";

function todayFirstOfMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function monthValueToFirstOfMonth(value) {
  if (!value) return todayFirstOfMonth();
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return todayFirstOfMonth();
  return `${match[1]}-${match[2]}-01`;
}

function firstOfMonthToMonthValue(firstOfMonth) {
  if (!firstOfMonth) return "";
  return firstOfMonth.slice(0, 7);
}

function toInt(digitString) {
  if (digitString === "" || digitString === null || digitString === undefined) {
    return 0;
  }
  const n = Number(digitString);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

export default function OperatingBudgetPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [month, setMonth] = useState(todayFirstOfMonth);
  const [edits, setEdits] = useState(() => new Map());
  const [added, setAdded] = useState([]);
  const [addAccountId, setAddAccountId] = useState("");
  const [formError, setFormError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;
  const isAdmin = staffQuery.data?.role_name === "Admin";

  const budgetQuery = useQuery({
    queryKey: ["accounting", "budget", month],
    queryFn: async () => fetchJson(`/api/accounting/budget?month=${month}`),
    enabled: !userLoading && !!user && canUseAccounting && !!month,
  });

  useEffect(() => {
    setEdits(new Map());
    setAdded([]);
    setAddAccountId("");
    setFormError(null);
    setInfoMessage(null);
  }, [month]);

  const serverLines = budgetQuery.data?.lines || [];
  const availableAccounts = budgetQuery.data?.available_accounts || [];

  const addedIds = useMemo(
    () => new Set(added.map((a) => Number(a.account_id))),
    [added],
  );

  const dropdownOptions = useMemo(
    () => availableAccounts.filter((a) => !addedIds.has(Number(a.id))),
    [availableAccounts, addedIds],
  );

  const mergedRows = useMemo(() => {
    const addedRows = added.map((a) => ({
      id: null,
      account_id: a.account_id,
      account_code: a.account_code,
      account_name: a.account_name,
      budget_amount: 0,
      spent: 0,
      remaining: 0,
      isNew: true,
    }));
    return [...serverLines, ...addedRows].sort((a, b) =>
      String(a.account_code || "").localeCompare(String(b.account_code || "")),
    );
  }, [serverLines, added]);

  function getRowAmount(row) {
    const key = Number(row.account_id);
    if (edits.has(key)) return toInt(edits.get(key));
    return Number(row.budget_amount || 0);
  }

  function handleEdit(accountId, digitString) {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(Number(accountId), digitString);
      return next;
    });
  }

  function handleAddAccount() {
    if (!addAccountId) return;
    const account = dropdownOptions.find(
      (a) => Number(a.id) === Number(addAccountId),
    );
    if (!account) return;
    setAdded((prev) => [
      ...prev,
      {
        account_id: Number(account.id),
        account_code: account.account_code,
        account_name: account.account_name,
      },
    ]);
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(Number(account.id), "0");
      return next;
    });
    setAddAccountId("");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setInfoMessage(null);
      const lines = mergedRows.map((row) => ({
        account_id: Number(row.account_id),
        amount: getRowAmount(row),
      }));
      return putJson("/api/accounting/budget", {
        period_month: month,
        lines,
      });
    },
    onSuccess: () => {
      setEdits(new Map());
      setAdded([]);
      setInfoMessage("Budget saved.");
      queryClient.invalidateQueries({ queryKey: ["accounting", "budget"] });
    },
    onError: (err) => {
      setFormError(err?.message || "Failed to save budget");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => deleteJson(`/api/accounting/budget/${id}`),
    onSuccess: () => {
      setInfoMessage("Budget line removed.");
      queryClient.invalidateQueries({ queryKey: ["accounting", "budget"] });
    },
    onError: (err) => {
      setFormError(err?.message || "Failed to remove budget line");
    },
  });

  const copyMutation = useMutation({
    mutationFn: async () =>
      postJson("/api/accounting/budget/copy", { to_month: month }),
    onSuccess: (data) => {
      setInfoMessage(
        `Copied ${data?.copied || 0} lines from ${data?.source_month || "last month"}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["accounting", "budget"] });
    },
    onError: (err) => {
      setFormError(err?.message || "Failed to copy budget");
    },
  });

  function handleRemove(row) {
    if (row.isNew) {
      setAdded((prev) =>
        prev.filter((a) => Number(a.account_id) !== Number(row.account_id)),
      );
      setEdits((prev) => {
        const next = new Map(prev);
        next.delete(Number(row.account_id));
        return next;
      });
      return;
    }
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Remove the budget line for ${row.account_code} • ${row.account_name}?`,
          );
    if (!ok) return;
    deleteMutation.mutate(row.id);
  }

  const totalBudget = useMemo(
    () => mergedRows.reduce((s, r) => s + getRowAmount(r), 0),
    [mergedRows, edits],
  );
  const totalSpent = useMemo(
    () => mergedRows.reduce((s, r) => s + Number(r.spent || 0), 0),
    [mergedRows],
  );
  const totalRemaining = totalBudget - totalSpent;

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
        title="Operating Budget"
        message="You don't have access to the accounting module."
      />
    );
  }

  const monthValue = firstOfMonthToMonthValue(month);
  const canCopy = serverLines.length === 0 && !budgetQuery.isLoading;
  const hasRows = mergedRows.length > 0;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Operating Budget"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar isAdmin={isAdmin} />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="max-w-[90%] mx-auto p-4 md:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Operating Budget
              </h1>
              <p className="text-slate-500">
                Set a monthly budget per expense account. Spent and Remaining
                are informational for now.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Month">
                <input
                  type="month"
                  value={monthValue}
                  onChange={(e) => setMonth(monthValueToFirstOfMonth(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                />
              </Field>

              <div className="flex items-end gap-2">
                {canCopy ? (
                  <button
                    onClick={() => copyMutation.mutate()}
                    disabled={copyMutation.isPending}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Copy className="w-4 h-4" />
                    {copyMutation.isPending ? "Copying…" : "Copy from last month"}
                  </button>
                ) : null}
              </div>
            </div>

            {formError ? (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}
            {infoMessage ? (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                {infoMessage}
              </div>
            ) : null}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Budget lines
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={addAccountId}
                  onChange={(e) => setAddAccountId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
                >
                  <option value="">Add account…</option>
                  {dropdownOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} • {a.account_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddAccount}
                  disabled={!addAccountId}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {budgetQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : budgetQuery.error ? (
              <p className="text-sm text-rose-600">
                Could not load budget.
              </p>
            ) : !hasRows ? (
              <p className="text-sm text-slate-500">
                No budget lines for this month yet. Add an account above, or
                copy from last month.
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3 w-48">Budget (UGX)</th>
                      <th className="py-2 pr-3 text-right">Spent (UGX)</th>
                      <th className="py-2 pr-3 text-right">Remaining (UGX)</th>
                      <th className="py-2 pr-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedRows.map((row) => {
                      const amount = getRowAmount(row);
                      const spent = Number(row.spent || 0);
                      const remaining = amount - spent;
                      const key = Number(row.account_id);
                      const editValue = edits.has(key)
                        ? edits.get(key)
                        : String(row.budget_amount || 0);
                      return (
                        <tr key={key} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-slate-800">
                              {row.account_code}
                            </div>
                            <div className="text-xs text-slate-500">
                              {row.account_name}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <MoneyInput
                              value={editValue}
                              onChange={(v) => handleEdit(key, v)}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 pr-3 text-right text-slate-700">
                            {formatCurrencyUGX(spent)}
                          </td>
                          <td
                            className={`py-2 pr-3 text-right font-medium ${
                              remaining < 0
                                ? "text-rose-600"
                                : "text-slate-800"
                            }`}
                          >
                            {formatCurrencyUGX(remaining)}
                          </td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              onClick={() => handleRemove(row)}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 disabled:opacity-50"
                              title="Remove line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td className="py-2 pr-3 font-semibold text-slate-700">
                        Total
                      </td>
                      <td className="py-2 pr-3 font-semibold text-slate-800">
                        {formatCurrencyUGX(totalBudget)}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-800">
                        {formatCurrencyUGX(totalSpent)}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-semibold ${
                          totalRemaining < 0 ? "text-rose-600" : "text-slate-800"
                        }`}
                      >
                        {formatCurrencyUGX(totalRemaining)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasRows}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-500">
              Spent counts both approved and pending debits to each expense
              account for the selected month. No enforcement is applied yet —
              these figures are informational.
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
