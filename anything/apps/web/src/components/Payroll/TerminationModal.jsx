"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  useTerminationSummary,
  useTerminateEmployee,
  usePayrollAssetAccounts,
} from "@/hooks/usePayroll";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      {...props}
    >
      {children}
    </select>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  const msg = error?.message || String(error);
  return (
    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {msg}
    </div>
  );
}

function PrimaryBtn({ children, disabled, onClick, type = "button" }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-sm font-medium hover:bg-[#08172c] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export default function TerminationModal({ employee, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [terminationDate, setTerminationDate] = useState(today);
  const [reason, setReason] = useState("");
  const [salaryType, setSalaryType] = useState("full");

  // Step 2 fields
  const [advanceAction, setAdvanceAction] = useState("recover");
  const [loanAction, setLoanAction] = useState("recover");
  const [shortfallAction, setShortfallAction] = useState("outstanding");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);

  const summaryQuery = useTerminationSummary(
    employee.id,
    terminationDate,
    salaryType,
    step >= 2,
  );
  const summary = summaryQuery.data || null;

  const terminateMutation = useTerminateEmployee();

  const accountsQuery = usePayrollAssetAccounts();
  const accounts = accountsQuery.data || [];

  const netPayable = summary?.net_payable ?? null;
  const needsPaymentAccount = netPayable !== null && netPayable > 0;

  const canProceedStep2 =
    summary &&
    !summaryQuery.isLoading &&
    !summaryQuery.isError &&
    (!needsPaymentAccount || paymentAccountId);

  const handleConfirm = () => {
    terminateMutation.mutate(
      {
        id: employee.id,
        payload: {
          termination_date: terminationDate,
          termination_reason: reason.trim() || null,
          salary_type: salaryType,
          advance_action: advanceAction,
          loan_action: loanAction,
          shortfall_action: shortfallAction,
          payment_account_id: paymentAccountId ? Number(paymentAccountId) : null,
          payment_date: paymentDate,
        },
      },
      { onSuccess },
    );
  };

  const salaryLabel = salaryType === "prorated" && summary
    ? `Prorate (${summary.days_worked}/${summary.days_in_month} days = ${fmt(summary.gross_salary)})`
    : `Full month (${fmt(employee.current_salary || 0)})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-semibold text-slate-800">
              {step === 1 && `Terminate Employee — ${employee.full_name}`}
              {step === 2 && `Settle Balances — ${employee.full_name}`}
              {step === 3 && "Confirm Termination"}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Step {step} of 3</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1 space-y-4">

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <FormField label="Termination Date" required>
                <Input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Reason (optional)">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Resignation, Redundancy"
                />
              </FormField>

              <FormField label="Salary for final month">
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="salaryType"
                      value="full"
                      checked={salaryType === "full"}
                      onChange={() => setSalaryType("full")}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-slate-700">
                      Pay full month ({fmt(employee.current_salary || 0)})
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="salaryType"
                      value="prorated"
                      checked={salaryType === "prorated"}
                      onChange={() => setSalaryType("prorated")}
                      className="mt-0.5"
                    />
                    <div className="text-sm text-slate-700">
                      <span>Prorate based on termination date</span>
                      {salaryType === "prorated" && summary && (
                        <span className="ml-1 text-slate-500">
                          ({summary.days_worked}/{summary.days_in_month} days = {fmt(summary.gross_salary)})
                        </span>
                      )}
                      {salaryType === "prorated" && summaryQuery.isLoading && (
                        <span className="ml-1 text-slate-400 text-xs">Calculating…</span>
                      )}
                    </div>
                  </label>
                </div>
              </FormField>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              {summaryQuery.isLoading ? (
                <p className="text-sm text-slate-400">Calculating…</p>
              ) : summaryQuery.isError ? (
                <p className="text-sm text-red-500">Failed to load summary</p>
              ) : summary ? (
                <>
                  {/* Salary breakdown */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gross salary</span>
                      <span className="font-medium">{fmt(summary.gross_salary)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Less PAYE</span>
                      <span>-{fmt(summary.paye)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Less NSSF (5%)</span>
                      <span>-{fmt(summary.nssf)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between font-medium">
                      <span>Net before deductions</span>
                      <span>{fmt(summary.net_before_advances)}</span>
                    </div>
                  </div>

                  {/* Advances */}
                  {summary.outstanding_advances > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700">
                        Outstanding advances: {fmt(summary.outstanding_advances)}
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="advanceAction" value="recover"
                            checked={advanceAction === "recover"}
                            onChange={() => setAdvanceAction("recover")} />
                          Recover from final pay
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="advanceAction" value="writeoff"
                            checked={advanceAction === "writeoff"}
                            onChange={() => setAdvanceAction("writeoff")} />
                          Write off to Bad Debt
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Loans */}
                  {summary.outstanding_loans > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700">
                        Outstanding loans: {fmt(summary.outstanding_loans)}
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="loanAction" value="recover"
                            checked={loanAction === "recover"}
                            onChange={() => setLoanAction("recover")} />
                          Recover from final pay
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="loanAction" value="writeoff"
                            checked={loanAction === "writeoff"}
                            onChange={() => setLoanAction("writeoff")} />
                          Write off to Bad Debt
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Net payable */}
                  <div className="border-t border-gray-100 pt-3 flex justify-between text-sm font-semibold">
                    <span>Net payable</span>
                    <span className={summary.net_payable < 0 ? "text-red-600" : "text-slate-800"}>
                      {fmt(summary.net_payable)}
                    </span>
                  </div>

                  {/* Shortfall handling */}
                  {summary.net_payable < 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                      <div className="text-sm font-medium text-amber-800">
                        ⚠ Employee owes Exela {fmt(summary.shortfall)}
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="shortfallAction" value="outstanding"
                            checked={shortfallAction === "outstanding"}
                            onChange={() => setShortfallAction("outstanding")} />
                          Leave as outstanding debt
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="shortfallAction" value="writeoff"
                            checked={shortfallAction === "writeoff"}
                            onChange={() => setShortfallAction("writeoff")} />
                          Write off to Bad Debt
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Payment details — only when employee is owed money */}
                  {summary.net_payable > 0 && (
                    <>
                      <FormField label="Paid from" required>
                        <Select
                          value={paymentAccountId}
                          onChange={(e) => setPaymentAccountId(e.target.value)}
                          required
                        >
                          <option value="">Select account…</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.account_code} — {a.account_name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Payment Date" required>
                        <Input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          required
                        />
                      </FormField>
                    </>
                  )}
                </>
              ) : null}
            </>
          )}

          {/* STEP 3 — Confirm */}
          {step === 3 && summary && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee</span>
                  <span className="font-medium">{employee.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Termination date</span>
                  <span>{fmtDate(terminationDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Final salary</span>
                  <span>{fmt(summary.gross_salary)} ({salaryType === "prorated" ? "prorated" : "full month"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Advances</span>
                  <span>{summary.outstanding_advances > 0 ? (advanceAction === "recover" ? "Recovered" : "Written off") : "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Loans</span>
                  <span>{summary.outstanding_loans > 0 ? (loanAction === "recover" ? "Recovered" : "Written off") : "None"}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-2">
                  <span>Net payable</span>
                  <span className={summary.net_payable < 0 ? "text-red-600" : ""}>{fmt(summary.net_payable)}</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                ⚠ This will permanently mark {employee.full_name} as terminated. This cannot be undone.
              </div>

              <ErrorBanner error={terminateMutation.error} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={terminateMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50 disabled:opacity-50"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            {step < 3 && (
              <PrimaryBtn
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 2 && !canProceedStep2}
              >
                Next →
              </PrimaryBtn>
            )}
            {step === 3 && (
              <button
                onClick={handleConfirm}
                disabled={terminateMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {terminateMutation.isPending ? "Processing…" : "Terminate Employee"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
