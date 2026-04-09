import { Save } from "lucide-react";
import { Field } from "./Field";
import { ordinalDay } from "@/utils/formatters";
import DatePopoverInput from "@/components/DatePopoverInput";

const DUE_DAY_OPTIONS = Array.from({ length: 31 }, (_v, i) => i + 1);
const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Select method…" },
  { value: "bank", label: "Bank" },
  { value: "mobile_money", label: "Mobile Money" },
];

export function LandlordForm({
  form,
  onFormChange,
  onSave,
  onCancel,
  isCreating,
  isSaving,
  error,
  canSave,
}) {
  const paymentMethod = form.payment_method || "";
  const isBank = paymentMethod === "bank";
  const isMobileMoney = paymentMethod === "mobile_money";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-800">
            {isCreating ? "New landlord" : "Edit landlord"}
          </div>
          <div className="text-sm text-slate-500">
            Due day and contract dates control reminders and invoicing.
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Full name">
          <input
            value={form.full_name}
            onChange={(e) =>
              onFormChange({ ...form, full_name: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>

        <Field label="Phone (optional)">
          <input
            value={form.phone}
            onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="+256…"
          />
        </Field>

        <Field label="Email (optional)">
          <input
            value={form.email}
            onChange={(e) => onFormChange({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>

        <Field label="Contract start date (optional)">
          <DatePopoverInput
            value={form.start_date || ""}
            onChange={(val) => onFormChange({ ...form, start_date: val })}
            placeholder="DD-MM-YYYY"
          />
        </Field>

        <Field label="Contract end date (optional)">
          <DatePopoverInput
            value={form.end_date || ""}
            onChange={(val) => onFormChange({ ...form, end_date: val })}
            placeholder="DD-MM-YYYY"
          />
          <div className="text-xs text-slate-500 mt-1">
            When this date is in the past, the landlord will be marked ended and
            auto-invoicing stops.
          </div>
        </Field>

        <Field label="Due day (every month)">
          <select
            value={form.due_day}
            onChange={(e) => onFormChange({ ...form, due_day: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select day…</option>
            {DUE_DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {ordinalDay(d)}
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-500 mt-1">
            This is the day of each month the landlord payout is due.
          </div>
        </Field>

        <Field label="Payment method">
          <select
            value={paymentMethod}
            onChange={(e) => {
              const nextMethod = e.target.value;
              const next = { ...form, payment_method: nextMethod };

              if (nextMethod === "bank") {
                next.mobile_money_name = "";
                next.mobile_money_phone = "";
              }
              if (nextMethod === "mobile_money") {
                next.bank_name = "";
                next.bank_account_title = "";
                next.bank_account_number = "";
              }
              if (nextMethod === "") {
                next.bank_name = "";
                next.bank_account_title = "";
                next.bank_account_number = "";
                next.mobile_money_name = "";
                next.mobile_money_phone = "";
              }

              onFormChange(next);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value || "_blank"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {isBank ? (
          <>
            <Field label="Bank">
              <input
                value={form.bank_name || ""}
                onChange={(e) =>
                  onFormChange({ ...form, bank_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                placeholder="e.g. Stanbic, Centenary"
              />
            </Field>

            <Field label="Account Title">
              <input
                value={form.bank_account_title || ""}
                onChange={(e) =>
                  onFormChange({ ...form, bank_account_title: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                placeholder="Name on account"
              />
            </Field>

            <Field label="Account Number">
              <input
                value={form.bank_account_number || ""}
                onChange={(e) =>
                  onFormChange({ ...form, bank_account_number: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                placeholder="Account number"
                inputMode="numeric"
              />
            </Field>
          </>
        ) : null}

        {isMobileMoney ? (
          <>
            <Field label="Name">
              <input
                value={form.mobile_money_name || ""}
                onChange={(e) =>
                  onFormChange({ ...form, mobile_money_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                placeholder="Registered name"
              />
            </Field>

            <Field label="Phone number">
              <input
                value={form.mobile_money_phone || ""}
                onChange={(e) =>
                  onFormChange({ ...form, mobile_money_phone: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                placeholder="+256…"
                inputMode="tel"
              />
            </Field>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          Could not save landlord.
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}
