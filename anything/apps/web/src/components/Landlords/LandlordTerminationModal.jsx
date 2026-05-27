"use client";

import { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@/utils/api";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });
}

function useTerminationSummary(landlordId, enabled) {
  return useQuery({
    queryKey: ["landlords", landlordId, "termination-summary"],
    queryFn: () => fetchJson(`/api/landlords/${landlordId}/termination-summary`),
    enabled: enabled && !!landlordId,
    staleTime: 0,
  });
}

function useCloseLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ landlordId, payload }) =>
      postJson(`/api/landlords/${landlordId}/end-leases`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

// ─── Step: Termination Date ───────────────────────────────────────────────────

function StepDate({ terminationDate, onDateChange }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800">Set Termination Date</h3>
      <p className="text-sm text-slate-600">
        Choose the date this landlord contract officially ends. Invoices and balances will be evaluated as of this date.
      </p>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Termination Date
        </label>
        <input
          type="date"
          value={terminationDate}
          max={today}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ─── Step: Balance Settlement ─────────────────────────────────────────────────

function StepBalance({ dueBalance, assetAccounts, settlement, onSettlementChange }) {
  const hasBalance = dueBalance > 0;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800">Settle Outstanding Balance</h3>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-800 font-medium">Due to Landlord (Account 2100)</div>
        <div className="text-2xl font-bold text-blue-900 mt-1">{fmt(dueBalance)}</div>
        {!hasBalance && (
          <div className="text-xs text-blue-700 mt-1">No outstanding balance — no payout required.</div>
        )}
      </div>

      {hasBalance ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Record the final payout to the landlord to clear this balance.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payout Amount
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={settlement.payout_amount}
              onChange={(e) => onSettlementChange({ ...settlement, payout_amount: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Paid From Account
            </label>
            <select
              value={settlement.payout_account_id}
              onChange={(e) => onSettlementChange({ ...settlement, payout_account_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_code} — {a.account_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Transaction Date
            </label>
            <input
              type="date"
              value={settlement.transaction_date}
              onChange={(e) => onSettlementChange({ ...settlement, transaction_date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          You can proceed to confirm — no payout entry is needed.
        </p>
      )}
    </div>
  );
}

// ─── Step: Confirm ────────────────────────────────────────────────────────────

function StepConfirm({ landlordName, terminationDate, dueBalance, settlement }) {
  const payoutAmount = Number(settlement?.payout_amount || 0);
  const willPayout = payoutAmount > 0 && !!settlement?.payout_account_id;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800">Confirm Landlord Close-out</h3>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          This action will permanently mark <strong>{landlordName}</strong> as ended. This cannot be undone automatically.
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b border-gray-100">
          <span className="text-slate-600">Termination Date</span>
          <span className="font-medium text-slate-800">{terminationDate}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-gray-100">
          <span className="text-slate-600">Outstanding Balance</span>
          <span className="font-medium text-slate-800">{fmt(dueBalance)}</span>
        </div>
        {willPayout ? (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-slate-600">Final Payout</span>
            <span className="font-medium text-green-700">{fmt(payoutAmount)}</span>
          </div>
        ) : dueBalance > 0 ? (
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-slate-600">Final Payout</span>
            <span className="text-slate-500 italic">Not recorded</span>
          </div>
        ) : null}
      </div>

      <p className="text-sm text-slate-600">
        Click <strong>Close Landlord</strong> to proceed.
      </p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function LandlordTerminationModal({ landlordId, landlordName, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [terminationDate, setTerminationDate] = useState(today);
  const [settlement, setSettlement] = useState({
    payout_amount: "",
    payout_account_id: "",
    transaction_date: today,
  });
  const [stepIndex, setStepIndex] = useState(0);

  const summaryQuery = useTerminationSummary(landlordId, true);
  const closeMutation = useCloseLandlord();

  const summary = summaryQuery.data || null;
  const isBlocked = summary?.blocked === true;
  const dueBalance = Number(summary?.due_to_landlords_balance || 0);
  const assetAccounts = summary?.asset_accounts || [];
  const hasBalance = dueBalance > 0;

  const steps = useMemo(() => {
    const s = ["date"];
    if (hasBalance) s.push("balance");
    s.push("confirm");
    return s;
  }, [hasBalance]);

  // Autofill payout amount when balance loads
  useEffect(() => {
    if (dueBalance > 0 && settlement.payout_amount === "") {
      setSettlement((prev) => ({ ...prev, payout_amount: String(dueBalance) }));
    }
  }, [dueBalance, settlement.payout_amount]);

  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const canNext = useMemo(() => {
    if (currentStep === "date") return !!terminationDate;
    if (currentStep === "balance") {
      if (!hasBalance) return true;
      const amt = Number(settlement.payout_amount);
      // Allow skipping payout (empty amount = no GL entry)
      return true;
    }
    return true;
  }, [currentStep, terminationDate, hasBalance, settlement]);

  const handleConfirm = () => {
    const payoutAmount = Number(settlement.payout_amount) || 0;
    const payload = {
      termination_date: terminationDate,
      balance_settlement:
        payoutAmount > 0 && settlement.payout_account_id
          ? {
              payout_amount: payoutAmount,
              payout_account_id: Number(settlement.payout_account_id),
              transaction_date: settlement.transaction_date || terminationDate,
            }
          : null,
    };

    closeMutation.mutate(
      { landlordId, payload },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      },
    );
  };

  const stepLabel = {
    date: "Termination Date",
    balance: "Settle Balance",
    confirm: "Confirm",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="text-base font-semibold text-slate-800">Close Landlord</div>
            <div className="text-xs text-slate-500 mt-0.5">{landlordName}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 pt-4 gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                  ${i < stepIndex ? "bg-green-100 text-green-700" : i === stepIndex ? "bg-blue-600 text-white" : "bg-gray-100 text-slate-400"}`}
              >
                {i < stepIndex ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-xs ${i === stepIndex ? "text-blue-700 font-medium" : "text-slate-400"}`}>
                {stepLabel[s]}
              </span>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[260px]">
          {summaryQuery.isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
              Loading…
            </div>
          ) : summaryQuery.error ? (
            <div className="text-red-600 text-sm">Failed to load termination summary.</div>
          ) : isBlocked ? (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <strong>Cannot close this landlord.</strong>
                  <p className="mt-1">{summary.message}</p>
                </div>
              </div>
              <div className="space-y-1">
                {summary.active_tenants?.map((t) => (
                  <div key={t.lease_id} className="text-sm text-slate-600 px-2 py-1 bg-gray-50 rounded">
                    {t.tenant_name} — {t.property_name}, Unit {t.unit_number}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentStep === "date" && (
                <StepDate
                  terminationDate={terminationDate}
                  onDateChange={setTerminationDate}
                />
              )}
              {currentStep === "balance" && (
                <StepBalance
                  dueBalance={dueBalance}
                  assetAccounts={assetAccounts}
                  settlement={settlement}
                  onSettlementChange={setSettlement}
                />
              )}
              {currentStep === "confirm" && (
                <StepConfirm
                  landlordName={landlordName}
                  terminationDate={terminationDate}
                  dueBalance={dueBalance}
                  settlement={settlement}
                />
              )}
            </>
          )}

          {closeMutation.error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {closeMutation.error?.message || "Failed to close landlord. Please try again."}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isBlocked && !summaryQuery.isLoading && !summaryQuery.error && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setStepIndex((i) => i - 1)}
              disabled={isFirst || closeMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {isLast ? (
              <button
                onClick={handleConfirm}
                disabled={closeMutation.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {closeMutation.isPending ? "Closing…" : "Close Landlord"}
              </button>
            ) : (
              <button
                onClick={() => setStepIndex((i) => i + 1)}
                disabled={!canNext}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {isBlocked && (
          <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
