"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { useTerminationSummary, useEndTenantLease } from "@/hooks/useTenants";

const TOTAL_STEPS = 5;

function fmt(n) {
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

function fmtDate(d) {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  return `${dd} ${months[Number(m) - 1]} ${y}`;
}

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full flex-1 transition-colors ${
            i < current
              ? "bg-[#0B1F3A]"
              : i === current
                ? "bg-[#0B1F3A] opacity-60"
                : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function InvoiceRow({ invoice, action, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-slate-800 font-medium truncate">
          {invoice.description ||
            `Rent – ${invoice.invoice_month}/${invoice.invoice_year}`}
        </div>
        <div className="text-xs text-slate-500">
          Outstanding: UGX {fmt(invoice.outstanding)}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChange(invoice.id, "keep")}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            action === "keep"
              ? "bg-slate-800 text-white"
              : "bg-gray-100 text-slate-600 hover:bg-gray-200"
          }`}
        >
          Keep
        </button>
        <button
          type="button"
          onClick={() => onChange(invoice.id, "void")}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            action === "void"
              ? "bg-rose-600 text-white"
              : "bg-gray-100 text-slate-600 hover:bg-gray-200"
          }`}
        >
          Void
        </button>
      </div>
    </div>
  );
}

export default function TerminationModal({ tenantId, leaseId, tenantName, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState(0);
  const [terminationDate, setTerminationDate] = useState(today);
  const [invoiceActions, setInvoiceActions] = useState({});
  const [depositForm, setDepositForm] = useState({
    deduction_amount: "",
    deduction_description: "",
    deduction_income_account_id: "",
    refund_account_id: "",
    settlement_date: today,
  });
  const [prepaymentForm, setPrepaymentForm] = useState({
    action: "refund",
    refund_account_id: "",
    transaction_date: today,
  });
  const [submitError, setSubmitError] = useState(null);

  const summaryQuery = useTerminationSummary(leaseId, terminationDate, true);
  const summary = summaryQuery.data;

  const endLeaseMutation = useEndTenantLease();

  const hasDeposit = summary?.deposit?.has_deposit === true;
  const hasPositivePrepayment = (summary?.prepayment?.balance || 0) > 0;
  const hasPreTermInvoices = (summary?.pre_term_invoices || []).length > 0;

  // Compute step indices dynamically based on what's applicable
  const steps = [
    "termination_date",
    hasPreTermInvoices ? "pre_term_invoices" : null,
    hasDeposit ? "deposit" : null,
    hasPositivePrepayment ? "prepayment" : null,
    "confirm",
  ].filter(Boolean);

  const currentStepName = steps[step] || "confirm";

  function nextStep() {
    if (step < steps.length - 1) setStep((s) => s + 1);
  }

  function prevStep() {
    if (step > 0) setStep((s) => s - 1);
  }

  // Initialize invoice actions when summary loads
  useEffect(() => {
    if (summary?.pre_term_invoices) {
      setInvoiceActions((prev) => {
        const next = { ...prev };
        for (const inv of summary.pre_term_invoices) {
          if (!(inv.id in next)) {
            next[inv.id] = "keep";
          }
        }
        return next;
      });
    }
  }, [summary?.pre_term_invoices]);

  // Sync settlement date to termination date on first load
  useEffect(() => {
    setDepositForm((f) => ({ ...f, settlement_date: terminationDate }));
    setPrepaymentForm((f) => ({ ...f, transaction_date: terminationDate }));
  }, [terminationDate]);

  const depositBalance = summary?.deposit?.balance || 0;
  const deductionAmount = Number(depositForm.deduction_amount) || 0;
  const netRefund = Math.max(0, depositBalance - deductionAmount);

  function buildPayload() {
    const invoiceHandling = Object.entries(invoiceActions).map(
      ([invoice_id, action]) => ({ invoice_id: Number(invoice_id), action }),
    );

    let depositSettlement = null;
    if (hasDeposit) {
      const deductionIncomeAccountId = depositForm.deduction_income_account_id
        ? Number(depositForm.deduction_income_account_id)
        : null;
      const refundAccountId = depositForm.refund_account_id
        ? Number(depositForm.refund_account_id)
        : null;

      if (refundAccountId || deductionAmount > 0) {
        depositSettlement = {
          net_refund: netRefund,
          refund_account_id: refundAccountId,
          deduction_amount: deductionAmount,
          deduction_description: depositForm.deduction_description || null,
          deduction_income_account_id: deductionAmount > 0 ? deductionIncomeAccountId : null,
          transaction_date: depositForm.settlement_date || terminationDate,
        };
      }
    }

    let prepaymentHandling = null;
    if (hasPositivePrepayment) {
      if (prepaymentForm.action === "refund" && prepaymentForm.refund_account_id) {
        prepaymentHandling = {
          action: "refund",
          refund_account_id: Number(prepaymentForm.refund_account_id),
          transaction_date: prepaymentForm.transaction_date || terminationDate,
        };
      } else if (prepaymentForm.action === "writeoff") {
        prepaymentHandling = {
          action: "writeoff",
          transaction_date: prepaymentForm.transaction_date || terminationDate,
        };
      }
    }

    return {
      termination_date: terminationDate,
      invoice_handling: invoiceHandling,
      deposit_settlement: depositSettlement,
      prepayment_handling: prepaymentHandling,
    };
  }

  function handleSubmit() {
    setSubmitError(null);
    endLeaseMutation.mutate(
      { tenantId, payload: buildPayload() },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
        onError: (e) => {
          setSubmitError(e?.message || "Could not end lease. Please try again.");
        },
      },
    );
  }

  const isLoading = summaryQuery.isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              End Lease
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{tenantName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <StepIndicator current={step} total={steps.length} />

          {isLoading && (
            <div className="text-center py-8 text-slate-500 text-sm">
              Loading termination summary…
            </div>
          )}

          {summaryQuery.isError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              Could not load termination summary. Please try again.
            </div>
          )}

          {!isLoading && !summaryQuery.isError && (
            <>
              {/* STEP: Termination date */}
              {currentStepName === "termination_date" && (
                <div className="space-y-4">
                  <div>
                    <SectionLabel>Step 1 — Select termination date</SectionLabel>
                    <label className="block text-sm text-slate-700 mb-1.5">
                      Termination date
                    </label>
                    <input
                      type="date"
                      value={terminationDate}
                      onChange={(e) => setTerminationDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  {summary && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                      {summary.auto_void_count > 0 ? (
                        <div className="text-slate-700">
                          <span className="font-medium">
                            {summary.auto_void_count} invoice
                            {summary.auto_void_count !== 1 ? "s" : ""}
                          </span>{" "}
                          after {fmtDate(terminationDate)} will be auto-voided
                          {summary.auto_void_total > 0 && (
                            <span className="text-slate-500">
                              {" "}(UGX {fmt(summary.auto_void_total)} cleared)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-500">
                          No future invoices to void for this termination date.
                        </div>
                      )}

                      {summary.pre_term_count > 0 && (
                        <div className="text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            {summary.pre_term_count} unpaid invoice
                            {summary.pre_term_count !== 1 ? "s" : ""} before
                            termination date — UGX{" "}
                            {fmt(summary.pre_term_outstanding)} outstanding.
                            You&apos;ll review these next.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP: Pre-termination invoices */}
              {currentStepName === "pre_term_invoices" && (
                <div>
                  <SectionLabel>
                    Step 2 — Review unpaid invoices before termination
                  </SectionLabel>
                  <p className="text-sm text-slate-600 mb-4">
                    These invoices are dated on or before the termination date
                    and still have an outstanding balance. Choose to keep them
                    open or void them.
                  </p>
                  <div>
                    {(summary?.pre_term_invoices || []).map((inv) => (
                      <InvoiceRow
                        key={inv.id}
                        invoice={inv}
                        action={invoiceActions[inv.id] || "keep"}
                        onChange={(invoiceId, action) =>
                          setInvoiceActions((prev) => ({
                            ...prev,
                            [invoiceId]: action,
                          }))
                        }
                      />
                    ))}
                  </div>
                  {(() => {
                    const keptTotal = (summary?.pre_term_invoices || [])
                      .filter((inv) => (invoiceActions[inv.id] || "keep") === "keep")
                      .reduce((s, inv) => s + inv.outstanding, 0);
                    return keptTotal > 0 ? (
                      <div className="mt-3 text-sm text-amber-700 font-medium">
                        UGX {fmt(keptTotal)} will remain open.
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* STEP: Deposit settlement */}
              {currentStepName === "deposit" && (
                <div className="space-y-4">
                  <SectionLabel>
                    {`Step ${steps.indexOf("deposit") + 1} — Security deposit settlement`}
                  </SectionLabel>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                    <span className="text-slate-600">Deposit held:</span>{" "}
                    <span className="font-semibold text-slate-800">
                      UGX {fmt(depositBalance)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Deduction amount (0 = full refund)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={depositBalance}
                      value={depositForm.deduction_amount}
                      onChange={(e) =>
                        setDepositForm((f) => ({
                          ...f,
                          deduction_amount: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      placeholder="0"
                    />
                  </div>

                  {deductionAmount > 0 && (
                    <>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Deduction description{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={depositForm.deduction_description}
                          onChange={(e) =>
                            setDepositForm((f) => ({
                              ...f,
                              deduction_description: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          placeholder="e.g. Broken window repair"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Deduction income account{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={depositForm.deduction_income_account_id}
                          onChange={(e) =>
                            setDepositForm((f) => ({
                              ...f,
                              deduction_income_account_id: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
                        >
                          <option value="">— Select account —</option>
                          {(summary?.income_accounts || []).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.account_code} – {a.account_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                    <span className="text-slate-600">Net refund to tenant:</span>{" "}
                    <span
                      className={`font-semibold ${netRefund > 0 ? "text-emerald-700" : "text-slate-800"}`}
                    >
                      UGX {fmt(netRefund)}
                    </span>
                    {netRefund === 0 && deductionAmount >= depositBalance && (
                      <span className="ml-2 text-slate-500 text-xs">
                        (Full forfeit — no cash out)
                      </span>
                    )}
                  </div>

                  {netRefund > 0 && (
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Refund to account{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={depositForm.refund_account_id}
                        onChange={(e) =>
                          setDepositForm((f) => ({
                            ...f,
                            refund_account_id: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
                      >
                        <option value="">— Select account —</option>
                        {(summary?.asset_accounts || []).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_code} – {a.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Settlement date
                    </label>
                    <input
                      type="date"
                      value={depositForm.settlement_date}
                      onChange={(e) =>
                        setDepositForm((f) => ({
                          ...f,
                          settlement_date: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
              )}

              {/* STEP: Prepayment */}
              {currentStepName === "prepayment" && (
                <div className="space-y-4">
                  <SectionLabel>
                    {`Step ${steps.indexOf("prepayment") + 1} — Prepayment balance`}
                  </SectionLabel>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
                    <span className="text-slate-600">Prepayment credit balance:</span>{" "}
                    <span className="font-semibold text-slate-800">
                      UGX {fmt(summary?.prepayment?.balance)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-2">
                      What to do with this balance?
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="prepayment_action"
                          value="refund"
                          checked={prepaymentForm.action === "refund"}
                          onChange={() =>
                            setPrepaymentForm((f) => ({
                              ...f,
                              action: "refund",
                            }))
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            Refund to tenant
                          </div>
                          <div className="text-xs text-slate-500">
                            DR Tenant Prepayments / CR cash account
                          </div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="prepayment_action"
                          value="writeoff"
                          checked={prepaymentForm.action === "writeoff"}
                          onChange={() =>
                            setPrepaymentForm((f) => ({
                              ...f,
                              action: "writeoff",
                            }))
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            Write off
                          </div>
                          <div className="text-xs text-slate-500">
                            DR Tenant Prepayments / CR Retained Earnings
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {prepaymentForm.action === "refund" && (
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Refund to account{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={prepaymentForm.refund_account_id}
                        onChange={(e) =>
                          setPrepaymentForm((f) => ({
                            ...f,
                            refund_account_id: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
                      >
                        <option value="">— Select account —</option>
                        {(summary?.asset_accounts || []).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_code} – {a.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Transaction date
                    </label>
                    <input
                      type="date"
                      value={prepaymentForm.transaction_date}
                      onChange={(e) =>
                        setPrepaymentForm((f) => ({
                          ...f,
                          transaction_date: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
              )}

              {/* STEP: Confirm */}
              {currentStepName === "confirm" && (
                <div className="space-y-3">
                  <SectionLabel>
                    Step {steps.length} — Confirm termination
                  </SectionLabel>

                  <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-slate-500">Termination date</span>
                      <span className="font-medium text-slate-800">
                        {fmtDate(terminationDate)}
                      </span>
                    </div>

                    {summary?.auto_void_count > 0 && (
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-500">Auto-voided invoices</span>
                        <span className="font-medium text-slate-800">
                          {summary.auto_void_count} invoice
                          {summary.auto_void_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {(() => {
                      const voidCount = Object.values(invoiceActions).filter(
                        (a) => a === "void",
                      ).length;
                      const keepCount = Object.values(invoiceActions).filter(
                        (a) => a === "keep",
                      ).length;
                      return (
                        <>
                          {voidCount > 0 && (
                            <div className="flex justify-between px-4 py-3">
                              <span className="text-slate-500">
                                Manually voided
                              </span>
                              <span className="font-medium text-rose-700">
                                {voidCount} invoice
                                {voidCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                          {keepCount > 0 && (
                            <div className="flex justify-between px-4 py-3">
                              <span className="text-slate-500">
                                Kept open
                              </span>
                              <span className="font-medium text-amber-700">
                                {keepCount} invoice
                                {keepCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {hasDeposit && (
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-500">Deposit</span>
                        <span className="font-medium text-slate-800">
                          {netRefund > 0
                            ? `Refund UGX ${fmt(netRefund)}`
                            : deductionAmount >= depositBalance
                              ? "Full forfeit"
                              : `Refund UGX ${fmt(netRefund)}`}
                          {deductionAmount > 0 && (
                            <span className="text-slate-500 font-normal ml-1">
                              + UGX {fmt(deductionAmount)} deduction
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {hasPositivePrepayment && prepaymentForm.action && (
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-slate-500">Prepayment</span>
                        <span className="font-medium text-slate-800 capitalize">
                          {prepaymentForm.action === "writeoff"
                            ? "Write off"
                            : `Refund UGX ${fmt(summary?.prepayment?.balance)}`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between px-4 py-3">
                      <span className="text-slate-500">Unit status</span>
                      <span className="font-medium text-slate-800">
                        Marked vacant
                      </span>
                    </div>
                  </div>

                  {submitError && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                      {submitError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={step === 0 ? onClose : prevStep}
            disabled={endLeaseMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-slate-700 disabled:opacity-50"
          >
            {step === 0 ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                Back
              </>
            )}
          </button>

          {currentStepName !== "confirm" ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={isLoading || summaryQuery.isError}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] text-sm disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={endLeaseMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm font-medium disabled:opacity-50"
            >
              {endLeaseMutation.isPending
                ? "Terminating…"
                : "Confirm Termination"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
