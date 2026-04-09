import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function DateRangeFilter({ from, to, onFromChange, onToChange }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="From">
          <DatePopoverInput
            value={from}
            onChange={onFromChange}
            placeholder="DD-MM-YYYY"
            className="bg-gray-50"
          />
        </Field>
        <Field label="To">
          <DatePopoverInput
            value={to}
            onChange={onToChange}
            placeholder="DD-MM-YYYY"
            className="bg-gray-50"
          />
        </Field>
        <div className="text-xs text-slate-500 flex items-end">
          This date range filters journal + P&L + Trial Balance. Balance Sheet
          uses "To".
        </div>
      </div>
    </div>
  );
}
