import { useState, useMemo } from "react";
import { Field } from "./Field";
import {
  formatNumberWithCommas,
  normalizeNumberInput,
} from "@/utils/formatNumberInput";

export function PropertyForm({
  form,
  onChange,
  error,
  landlordOptions,
  disabled,
}) {
  const [feeFixedFocused, setFeeFixedFocused] = useState(false);
  const [feePercentFocused, setFeePercentFocused] = useState(false);

  const landlordSelectOptions = landlordOptions.map((l) => ({
    value: String(l.id),
    label: l.label,
  }));

  landlordSelectOptions.unshift({ value: "", label: "Select landlord…" });

  const propertyTypeOptions = useMemo(() => {
    const base = [
      { value: "", label: "Select type…" },
      { value: "Residential", label: "Residential" },
      { value: "Commercial", label: "Commercial" },
      { value: "Both", label: "Both" },
    ];

    const current = form.property_type || "";
    const allowed = new Set(["", "Residential", "Commercial", "Both"]);
    if (current && !allowed.has(current)) {
      base.splice(1, 0, { value: current, label: `${current} (current)` });
    }

    return base;
  }, [form.property_type]);

  const feeType = form.management_fee_type || "percent";
  const feeTypeOptions = [
    { value: "percent", label: "Percentage (%)" },
    { value: "fixed", label: "Fixed amount (UGX)" },
  ];

  const feeFixedRaw = normalizeNumberInput(form.management_fee_fixed_amount, {
    allowDecimal: false,
  });
  const feePercentRaw = normalizeNumberInput(form.management_fee_percent, {
    allowDecimal: true,
  });

  const feeFixedDisplay = feeFixedFocused
    ? feeFixedRaw
    : formatNumberWithCommas(feeFixedRaw, { allowDecimal: false });

  const feePercentDisplay = feePercentFocused
    ? feePercentRaw
    : formatNumberWithCommas(feePercentRaw, { allowDecimal: true });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {/* Row 1: Landlord | Property name */}
      <Field
        label="Landlord"
        value={String(form.landlord_id || "")}
        onChange={(v) => onChange({ ...form, landlord_id: v })}
        asSelect
        options={landlordSelectOptions}
        disabled={disabled}
        required
      />

      <Field
        label="Property name"
        value={form.property_name}
        onChange={(v) => onChange({ ...form, property_name: v })}
        disabled={disabled}
        required
      />

      {/* Row 2: Address | Type */}
      <Field
        label="Address (optional)"
        value={form.address}
        onChange={(v) => onChange({ ...form, address: v })}
        placeholder="Plot, street, area"
        disabled={disabled}
      />

      <Field
        label="Type"
        value={String(form.property_type || "")}
        onChange={(v) => onChange({ ...form, property_type: v })}
        asSelect
        options={propertyTypeOptions}
        disabled={disabled}
        required
      />

      {/* Row 3: Management fee type | Management fee value */}
      <Field
        label="Management fee type"
        value={String(feeType)}
        onChange={(v) => {
          const nextType = v;
          const next = { ...form, management_fee_type: nextType };
          if (nextType === "fixed") {
            if (next.management_fee_fixed_amount === undefined) {
              next.management_fee_fixed_amount = "";
            }
          } else {
            next.management_fee_fixed_amount = "";
          }
          onChange(next);
        }}
        asSelect
        options={feeTypeOptions}
        disabled={disabled}
        required
      />

      {feeType === "fixed" ? (
        <Field
          label="Management fee (UGX per month)"
          value={feeFixedDisplay}
          onChange={(v) =>
            onChange({
              ...form,
              management_fee_fixed_amount: normalizeNumberInput(v, {
                allowDecimal: false,
              }),
            })
          }
          type="text"
          inputMode="numeric"
          onFocus={() => setFeeFixedFocused(true)}
          onBlur={() => setFeeFixedFocused(false)}
          disabled={disabled}
          required
        />
      ) : (
        <Field
          label="Management fee (%)"
          value={feePercentDisplay}
          onChange={(v) =>
            onChange({
              ...form,
              management_fee_percent: normalizeNumberInput(v, {
                allowDecimal: true,
              }),
            })
          }
          type="text"
          inputMode="decimal"
          onFocus={() => setFeePercentFocused(true)}
          onBlur={() => setFeePercentFocused(false)}
          disabled={disabled}
          required
        />
      )}

      {/* Row 4: Notes (full width) */}
      <Field
        label="Notes (optional)"
        value={form.notes}
        onChange={(v) => onChange({ ...form, notes: v })}
        placeholder="Any internal notes"
        disabled={disabled}
      />

      {error && (
        <p className="md:col-span-2 text-sm text-rose-600">
          {error?.message ||
            (typeof error === "object" && error?.error
              ? error.error
              : typeof error === "string"
                ? error
                : "Could not save property. Please check all fields.")}
        </p>
      )}
    </div>
  );
}
