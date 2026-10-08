"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import TerminationModal from "@/components/Tenants/TerminationModal";
import {
  useDecommissionSummary,
  useDecommissionProperty,
} from "@/hooks/useProperties";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const STEPS = ["leases", "confirm"];
const STEP_LABELS = { leases: "Leases", confirm: "Confirm" };

function StepPills({ stepIndex }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-4">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
              i < stepIndex
                ? "bg-green-100 text-green-700"
                : i === stepIndex
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-slate-400"
            }`}
          >
            {i < stepIndex ? <Check className="w-3 h-3" /> : i + 1}
          </span>
          <span
            className={`text-xs ${i === stepIndex ? "text-blue-700 font-medium" : "text-slate-400"}`}
          >
            {STEP_LABELS[s]}
          </span>
          {i < STEPS.length - 1 && (
            <ChevronRight className="w-3 h-3 text-gray-300" />
          )}
        </div>
      ))}
    </div>
  );
}

function LeaseQueue({ leases, onEndLease }) {
  if (leases.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
        No active leases remain. You can continue to decommission this property.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        End each active lease before decommissioning. {leases.length} lease
        {leases.length === 1 ? "" : "s"} remaining.
      </p>
      <div className="overflow-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-gray-100">
              <th className="py-2 px-3">Tenant</th>
              <th className="py-2 px-3 whitespace-nowrap">Unit</th>
              <th className="py-2 px-3 whitespace-nowrap">Lease end</th>
              <th className="py-2 px-3 text-right whitespace-nowrap">
                Outstanding
              </th>
              <th className="py-2 px-3 text-right whitespace-nowrap">
                Deposit held
              </th>
              <th className="py-2 px-3 text-right whitespace-nowrap">
                Prepayment
              </th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {leases.map((l) => (
              <tr key={l.lease_id} className="border-b last:border-b-0">
                <td className="py-2 px-3 font-medium text-slate-800">
                  {l.tenant_name}
                </td>
                <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                  {l.unit_number || "—"}
                </td>
                <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                  {formatDate(l.end_date) || "—"}
                </td>
                <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrencyUGX(l.outstanding)}
                </td>
                <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrencyUGX(l.deposit_held)}
                </td>
                <td
                  className="py-2 px-3 text-right text-slate-700 whitespace-nowrap"
                  title="Tenant-wide prepayment balance"
                >
                  {formatCurrencyUGX(l.prepayment)}
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEndLease(l)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium"
                    >
                      End lease
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="px-3 py-1.5 rounded-lg bg-gray-50 text-slate-400 border border-gray-200 text-xs cursor-not-allowed"
                    >
                      Transfer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Amounts in UGX.</p>
    </div>
  );
}

function ConfirmStep({ propertyName }) {
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p>
        Decommission <strong>{propertyName}</strong>?
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>No new rent invoices will be generated for this property.</li>
        <li>
          The property is archived: it's hidden from the property list and its
          units can't take new leases.
        </li>
        <li>
          Its history (invoices, payments, ledger) is kept. You can reactivate
          it later from the archived list.
        </li>
      </ul>
    </div>
  );
}

export function DecommissionModal({ property, onClose, onDecommissioned }) {
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [endingLease, setEndingLease] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const summaryQuery = useDecommissionSummary(property.id, true);
  const decommissionMutation = useDecommissionProperty();

  const summary = summaryQuery.data;
  const leases = summary?.active_leases || [];
  const alreadyArchived = summary?.property?.is_archived === true;
  const canConfirm = !!summary && leases.length === 0 && !alreadyArchived;
  const step = STEPS[stepIndex];

  function onLeaseEnded() {
    setEndingLease(null);
    // The end-lease hook doesn't refresh property queries.
    summaryQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ["units", property.id] });
  }

  function handleDecommission() {
    setSubmitError(null);
    decommissionMutation.mutate(property.id, {
      onSuccess: () => {
        onDecommissioned?.();
        onClose();
      },
      onError: (error) => {
        setSubmitError(error.message || "Failed to decommission property");
        summaryQuery.refetch();
      },
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Decommission Property
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {property.property_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <StepPills stepIndex={stepIndex} />

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[200px]">
            {summaryQuery.isLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Loading active leases…
              </div>
            ) : summaryQuery.isError ? (
              <div className="text-sm text-red-600">
                Failed to load decommission summary.
              </div>
            ) : alreadyArchived ? (
              <div className="text-sm text-slate-600">
                This property is already archived.
              </div>
            ) : step === "leases" ? (
              <LeaseQueue leases={leases} onEndLease={setEndingLease} />
            ) : (
              <ConfirmStep propertyName={property.property_name} />
            )}

            {submitError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <button
              type="button"
              onClick={stepIndex === 0 ? onClose : () => setStepIndex(0)}
              disabled={decommissionMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-slate-700 disabled:opacity-50"
            >
              {stepIndex === 0 ? (
                "Cancel"
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </>
              )}
            </button>

            {step === "leases" ? (
              <button
                type="button"
                onClick={() => setStepIndex(1)}
                disabled={!canConfirm}
                title={
                  canConfirm ? undefined : "End all active leases to continue"
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] text-sm disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDecommission}
                disabled={!canConfirm || decommissionMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm font-medium disabled:opacity-50"
              >
                {decommissionMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Decommission
              </button>
            )}
          </div>
        </div>
      </div>

      {endingLease && (
        <TerminationModal
          tenantId={endingLease.tenant_id}
          leaseId={endingLease.lease_id}
          tenantName={endingLease.tenant_name}
          onClose={() => setEndingLease(null)}
          onSuccess={onLeaseEnded}
        />
      )}
    </>
  );
}
