import { useState, useCallback } from "react";
import { X, AlertTriangle } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function ReconcileModal({ reconciliation, onClose, onConfirm, isPending }) {
  const { month, year, gl_net, payment_note_net, difference, suggested_action } =
    reconciliation || {};

  const [action, setAction] = useState(suggested_action || "credit");
  const [description, setDescription] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [txDate, setTxDate] = useState(today);

  const absAmount = Math.abs(Number(difference || 0));

  const canConfirm =
    !!action && !!description.trim() && !!txDate && absAmount > 0 && !isPending;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm({
      action,
      amount: absAmount,
      description: description.trim(),
      transaction_date: txDate,
      month,
      year,
    });
  }, [action, absAmount, description, txDate, month, year, canConfirm, onConfirm]);

  const monthName = MONTHS[(Number(month) || 1) - 1] || "";
  const title = `Reconciliation — ${monthName} ${year}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="text-base font-semibold text-slate-800">{title}</div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">GL Net (Account 2100)</span>
              <span className="font-medium text-slate-800">UGX {fmt(gl_net)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Note Net</span>
              <span className="font-medium text-slate-800">UGX {fmt(payment_note_net)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="text-slate-500">Difference</span>
              <span
                className={`font-semibold ${
                  absAmount < 1 ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                UGX {fmt(difference)}
              </span>
            </div>
          </div>

          {absAmount < 1 ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center gap-2">
              Already reconciled — no adjustment needed.
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Posting a <strong>{action === "credit" ? "credit" : "deduction"}</strong> of{" "}
                <strong>UGX {fmt(absAmount)}</strong> will adjust account 2100.
              </span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
              >
                <option value="credit">Credit (increase landlord payable)</option>
                <option value="deduction">Deduction (reduce landlord payable)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Reconciliation adjustment for May 2026"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-gray-200 text-slate-700 hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-5 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50 text-sm"
          >
            {isPending ? "Posting…" : "Confirm Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}
