import { Save } from "lucide-react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function JournalEntryForm({
  date,
  description,
  reference,
  debitAccount,
  creditAccount,
  amount,
  accountOptions,
  onDateChange,
  onDescriptionChange,
  onReferenceChange,
  onDebitChange,
  onCreditChange,
  onAmountChange,
  onSubmit,
  isPending,
  error,
  successMessage,
}) {
  const canPost =
    date && description && debitAccount && creditAccount && amount;

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">
        New Journal Entry
      </h3>

      <div className="space-y-3">
        {/* Row 1: Date | Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. Office rent"
            />
          </Field>
        </div>

        {/* Row 2: Amount | Reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Amount (UGX)">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            />
          </Field>
          <Field label="Reference (Optional)">
            <input
              value={reference}
              onChange={(e) => onReferenceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            />
          </Field>
        </div>

        {/* Row 3: Debit Account | Credit Account */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Debit Account">
            <select
              value={debitAccount}
              onChange={(e) => onDebitChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            >
              <option value="">Select…</option>
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Credit Account">
            <select
              value={creditAccount}
              onChange={(e) => onCreditChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            >
              <option value="">Select…</option>
              {accountOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {successMessage ? (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {error?.message || "Could not create journal entry."}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !canPost}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving..." : "Post Entry"}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center">
        Current model is simplified: one debit + one credit per entry.
      </div>
    </div>
  );
}
