import { useState, useMemo, useCallback } from "react";
import { Save, Search, X } from "lucide-react";
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
  const [landlordSearch, setLandlordSearch] = useState("");
  const [showLandlordDropdown, setShowLandlordDropdown] = useState(false);
  const [propertyDisplay, setPropertyDisplay] = useState("");

  const canPost =
    !!landlordId &&
    !!propertyId &&
    !!date &&
    !!description &&
    !!amount &&
    !!paymentAccountId;

  const filteredLandlords = useMemo(() => {
    if (!landlordSearch.trim()) return landlords || [];
    const lower = landlordSearch.toLowerCase();
    return (landlords || []).filter((l) =>
      (l.full_name || "").toLowerCase().includes(lower),
    );
  }, [landlords, landlordSearch]);

  const filteredProperties = useMemo(() => {
    if (!landlordId) return [];
    return (properties || []).filter(
      (p) => String(p.landlord_id) === String(landlordId),
    );
  }, [properties, landlordId]);

  const onSelectLandlord = useCallback(
    (landlord) => {
      const title = landlord.title ? `${landlord.title} ` : "";
      onLandlordChange(String(landlord.id));
      setLandlordSearch(`${title}${landlord.full_name}`);
      setShowLandlordDropdown(false);
      // Auto-select if exactly one property
      const landlordProps = (properties || []).filter(
        (p) => String(p.landlord_id) === String(landlord.id),
      );
      if (landlordProps.length === 1) {
        onPropertyChange(String(landlordProps[0].id));
        setPropertyDisplay(landlordProps[0].property_name || "");
      } else {
        onPropertyChange("");
        setPropertyDisplay("");
      }
    },
    [onLandlordChange, onPropertyChange, properties],
  );

  const onClearLandlord = useCallback(() => {
    onLandlordChange("");
    setLandlordSearch("");
    onPropertyChange("");
    setPropertyDisplay("");
  }, [onLandlordChange, onPropertyChange]);

  const landlordDropdownVisible =
    showLandlordDropdown && filteredLandlords.length > 0;

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
        {/* Row 1: Landlord search | Property */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Landlord">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={landlordSearch}
                  onChange={(e) => {
                    setLandlordSearch(e.target.value);
                    setShowLandlordDropdown(true);
                    if (!e.target.value.trim()) onClearLandlord();
                  }}
                  onFocus={() => setShowLandlordDropdown(true)}
                  placeholder="Search landlord by name…"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
                {landlordId && (
                  <button
                    type="button"
                    onClick={onClearLandlord}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {landlordDropdownVisible && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredLandlords.map((l) => {
                    const isSelected = l.id === Number(landlordId);
                    const title = l.title ? `${l.title} ` : "";
                    const label = `${title}${l.full_name}`;
                    const landlordProps = (properties || []).filter(
                      (p) => String(p.landlord_id) === String(l.id),
                    );
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onSelectLandlord(l)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                          isSelected ? "bg-sky-50 font-medium" : ""
                        }`}
                      >
                        <div className="font-medium text-slate-800">{label}</div>
                        {landlordProps.length > 0 && (
                          <div className="text-xs text-slate-500">
                            {landlordProps.map((p) => p.property_name).join(", ")}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>

          <Field label="Property">
            {landlordId && filteredProperties.length === 1 ? (
              <input
                type="text"
                value={propertyDisplay}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-slate-600 text-sm outline-none cursor-default"
              />
            ) : (
              <select
                value={propertyId}
                onChange={(e) => {
                  onPropertyChange(e.target.value);
                  const found = filteredProperties.find(
                    (p) => String(p.id) === e.target.value,
                  );
                  setPropertyDisplay(found ? found.property_name : "");
                }}
                disabled={!landlordId || filteredProperties.length === 0}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none disabled:bg-gray-100 disabled:text-slate-500"
              >
                {!landlordId ? (
                  <option value="">Select landlord first…</option>
                ) : (
                  <option value="">Select property…</option>
                )}
                {filteredProperties.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.property_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {/* Row 2: Amount | Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Amount (UGX)">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            />
          </Field>

          <Field label="Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
        </div>

        {/* Row 3: Description | Paid from Account */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      {landlordDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowLandlordDropdown(false)}
        />
      )}

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
