import { Plus } from "lucide-react";
import { Field } from "./Field";

export function AccountForm({
  accountCode,
  accountName,
  accountType,
  onCodeChange,
  onNameChange,
  onTypeChange,
  onSubmit,
  isPending,
  error,
}) {
  const canSubmit = accountCode && accountName;

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mb-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Add account</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Code">
          <input
            value={accountCode}
            onChange={(e) => onCodeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            placeholder="e.g. 1110"
          />
        </Field>
        <Field label="Name">
          <input
            value={accountName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            placeholder="e.g. Bank - Stanbic"
          />
        </Field>
        <Field label="Type">
          <select
            value={accountType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          >
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Equity">Equity</option>
          </select>
        </Field>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          Could not create account.
        </div>
      ) : null}

      <button
        onClick={onSubmit}
        disabled={isPending || !canSubmit}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {isPending ? "Saving..." : "Add"}
      </button>
    </div>
  );
}
