import { useState } from "react";
import {
  formatNumberWithCommas,
  normalizeNumberInput,
} from "@/utils/formatNumberInput";

// Integer-only money input. Holds/emits a clean digit string (e.g. "300000"),
// displays formatted "300,000" when blurred and plain digits while focused.
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
  disabled = false,
  className = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none",
}) {
  const [focused, setFocused] = useState(false);

  const raw = normalizeNumberInput(value, { allowDecimal: false });
  const display = focused
    ? raw
    : formatNumberWithCommas(raw, { allowDecimal: false });

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) =>
        onChange(normalizeNumberInput(e.target.value, { allowDecimal: false }))
      }
      className={className}
    />
  );
}

export default MoneyInput;
