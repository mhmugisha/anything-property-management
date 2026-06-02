"use client";

import { useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { fetchJson, postJson } from "@/utils/api";
import { X } from "lucide-react";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const year = dt.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function VoidModal({ preview, onCancel, onConfirm, isPending }) {
  const { transaction, warnings } = preview;
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-slate-800">Void Transaction</h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Transaction details */}
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span>{fmtDate(transaction.date)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">Description</span>
              <span className="text-right text-slate-800">{transaction.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount</span>
              <span className="font-medium">{fmt(transaction.amount)}</span>
            </div>
            {transaction.source_type && (
              <div className="flex justify-between">
                <span className="text-slate-500">Source</span>
                <span className="text-slate-600">{transaction.source_type}</span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-slate-600">
            Are you sure you want to void this transaction? This action cannot be undone.
          </p>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Posted in error"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Voiding…" : "Void Transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VoidTransactionPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const [transactions, setTransactions] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [preview, setPreview] = useState(null);
  const [previewTxId, setPreviewTxId] = useState(null);
  const [voidPending, setVoidPending] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const isLoading = userLoading || staffQuery.isLoading;
  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;
  const isAdmin = staffQuery.data?.role_name === "Admin";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
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

  if (!canUseAccounting || !isAdmin) {
    return (
      <AccessDenied
        title="Void Transaction"
        message="This tool is only available to Admins."
      />
    );
  }

  const handleSearch = async () => {
    setSearching(true);
    setSearchError(null);
    setSuccessMsg(null);
    try {
      const params = new URLSearchParams({ order: "desc", limit: "50" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (description.trim()) params.set("description", description.trim());
      if (amount.trim()) params.set("amount", amount.trim());
      const data = await fetchJson(`/api/accounting/transactions?${params}`);
      setTransactions(data.transactions || []);
    } catch (e) {
      setSearchError(e?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleVoidClick = async (txId) => {
    try {
      const data = await postJson(`/api/accounting/transactions/${txId}/void`, {
        confirm: false,
      });
      if (data.requires_confirmation) {
        setPreview(data);
        setPreviewTxId(txId);
      }
    } catch (e) {
      alert(e?.message || "Failed to load void preview");
    }
  };

  const handleConfirmVoid = async (reason) => {
    if (!previewTxId) return;
    setVoidPending(true);
    try {
      await postJson(`/api/accounting/transactions/${previewTxId}/void`, {
        confirm: true,
        reason,
      });
      setTransactions((prev) => (prev || []).filter((t) => Number(t.id) !== previewTxId));
      setSuccessMsg("Transaction voided.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setPreview(null);
      setPreviewTxId(null);
    } catch (e) {
      alert(e?.message || "Failed to void transaction");
    } finally {
      setVoidPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Void Transaction"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="accounting"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar isAdmin={isAdmin} />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Void Transaction</h1>
            <p className="text-slate-500 text-sm mt-0.5">Search for and void accidental GL entries</p>
          </div>

          {/* Search filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search description…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Exact amount"
                  className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-sm font-medium hover:bg-[#08172c] disabled:opacity-50"
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {/* Error */}
          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {searchError}
            </div>
          )}

          {/* Results */}
          {transactions === null ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-slate-400">
              Enter filters above and click Search to find transactions.
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-slate-400">
              No transactions found.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Debit Account</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Credit Account</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(tx.transaction_date)}</td>
                      <td className="px-4 py-3 text-slate-800 max-w-xs">
                        <div className="truncate">{tx.description}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {tx.debit_code ? `${tx.debit_code} – ${tx.debit_name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {tx.credit_code ? `${tx.credit_code} – ${tx.credit_name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                        {fmt(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {tx.source_type || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleVoidClick(Number(tx.id))}
                          className="px-3 py-1 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 whitespace-nowrap"
                        >
                          Void
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {preview && (
        <VoidModal
          preview={preview}
          onCancel={() => { setPreview(null); setPreviewTxId(null); }}
          onConfirm={handleConfirmVoid}
          isPending={voidPending}
        />
      )}
    </div>
  );
}
