import { Wallet, Save, FileText } from "lucide-react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function PayoutCard({
  payoutDate,
  payoutAmount,
  payoutMethod,
  payoutRef,
  onPayoutDateChange,
  onPayoutAmountChange,
  onPayoutMethodChange,
  onPayoutRefChange,
  onRecordPayout,
  isPropertySelected,
  isSaving,
  error,
  success,
  onOpenPaymentNote,
  paymentNoteDisabled,
  paymentNoteTitle,
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-4 h-4 text-slate-500" />
        <div className="text-sm font-semibold text-slate-800">
          Record Landlord Payout
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Payout Date">
          <DatePopoverInput
            value={payoutDate}
            onChange={onPayoutDateChange}
            placeholder="DD-MM-YYYY"
            className="bg-white"
          />
        </Field>
        <Field label="Amount (UGX)">
          <input
            type="number"
            value={payoutAmount}
            onChange={(e) => onPayoutAmountChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          />
        </Field>
        <Field label="Account">
          <select
            value={payoutMethod}
            onChange={(e) => onPayoutMethodChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          >
            <option value="Bank Account - Operating">
              Bank Account - Operating
            </option>
            <option value="Cash on Hand">Cash on Hand</option>
            <option value="MTN MoMo">MTN MoMo</option>
            <option value="Airtel Money">Airtel Money</option>
          </select>
        </Field>
        <Field label="Reference (Optional)">
          <input
            value={payoutRef}
            onChange={(e) => onPayoutRefChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onOpenPaymentNote}
          disabled={paymentNoteDisabled}
          title={paymentNoteTitle || "Payment Note"}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50 w-full sm:w-auto"
        >
          <FileText className="w-4 h-4" />
          Payment Note
        </button>

        <button
          onClick={onRecordPayout}
          disabled={!isPropertySelected || !payoutAmount || isSaving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Payout"}
        </button>
      </div>
      {success ? (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Payout successful.
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {error.message || "Could not record payout."}
        </div>
      ) : null}
    </div>
  );
}
