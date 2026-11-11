import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/utils/formatters";

// Confirm dialog for useDuplicateReceiptGuard. Renders nothing when there is
// no pending duplicate.
export function DuplicateReceiptDialog({ pending, onCancel, onConfirm, isSaving }) {
  if (!pending) return null;

  const existing = pending.existing || [];
  const first = existing[0] || {};
  const ref = pending.payload?.reference_number || first.reference_number || "";
  const amount = Number(pending.payload?.amount ?? first.amount ?? 0).toLocaleString();
  const date = formatDate(first.payment_date) || "an earlier date";
  const name = first.recorded_by_name || "unknown";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-white rounded-2xl p-5 shadow-lg space-y-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">Possible duplicate payment</h3>
            <p className="text-sm text-slate-600">
              A payment with receipt {ref} for {amount} is already recorded for
              this tenant (on {date}, by {name}). Record anyway?
            </p>
            {existing.length > 1 ? (
              <p className="text-xs text-slate-500">
                {existing.length} matching payments found.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
          >
            Record anyway
          </button>
        </div>
      </div>
    </div>
  );
}
