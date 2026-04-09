import { Save } from "lucide-react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function LandlordDeductionForm({
  landlordId,
  propertyId,
  date,
  description,
  amount,
  paymentAccountId,
  landlords,
  properties,
  paymentAccounts,
  onLandlordChange,
  onPropertyChange,
  onDateChange,
  onDescriptionChange,
  onAmountChange,
  onPaymentAccountChange,
  onSubmit,
  isPending,
}) {
  const canPost =
    !!landlordId &&
    !!propertyId &&
    !!date &&
    !!description &&
    !!amount &&
    !!paymentAccountId;

  const landlordOptions = (landlords || []).map((l) => {
    const title = l.title ? `${l.title} ` : "";
    const label = `${title}${l.full_name}`;
    return { value: String(l.id), label };
  });

  const filteredProperties = (properties || []).filter((p) => {
    if (!landlordId) return false;
    return String(p.landlord_id) === String(landlordId);
  });

  const propertyOptions = filteredProperties.map((p) => {
    return { value: String(p.id), label: p.property_name };
  });

  const isPropertySelectDisabled = !landlordId || propertyOptions.length === 0;

  const handleLandlordChange = (next) => {
    onLandlordChange(next);
    // landlord changed => property (if any) may no longer be valid
    if (propertyId) {
      onPropertyChange("");
    }
  };

  const paymentAccountOptions = (paymentAccounts || []).map((acc) => ({
    value: String(acc.id),
    label: `${acc.account_code} • ${acc.account_name}`,
  }));

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">
        New Landlord Deduction
      </h3>

      <div className="space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Landlord">
            <select
              value={landlordId}
              onChange={(e) => handleLandlordChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            >
              <option value="">Select landlord…</option>
              {landlordOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Property">
            <select
              value={propertyId}
              onChange={(e) => onPropertyChange(e.target.value)}
              disabled={isPropertySelectDisabled}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none disabled:bg-gray-100 disabled:text-slate-500"
            >
              {!landlordId ? (
                <option value="">Select landlord first…</option>
              ) : (
                <option value="">Select property…</option>
              )}
              {propertyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>

          <Field label="Amount (UGX)">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            />
          </Field>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. Plumbing repair"
            />
          </Field>

          <Field label="Paid from Account">
            <select
              value={paymentAccountId}
              onChange={(e) => onPaymentAccountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            >
              <option value="">Select account…</option>
              {paymentAccountOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !canPost}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving..." : "Record Deduction"}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center">
        Deduct expenses paid on behalf of the landlord
      </div>
    </div>
  );
}
