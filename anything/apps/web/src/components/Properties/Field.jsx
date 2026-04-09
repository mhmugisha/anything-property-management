import { useCallback } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  asSelect,
  options,
  disabled,
  onFocus,
  onBlur,
  inputMode,
}) {
  const handleChange = useCallback(
    (e) => {
      if (disabled) return;
      onChange(e.target.value);
    },
    [onChange, disabled],
  );

  const baseClass =
    "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500";

  const inputClass = disabled
    ? `${baseClass} bg-gray-100 text-slate-600 cursor-not-allowed focus:ring-0`
    : `${baseClass} bg-gray-50`;

  const selectOptions = options || [];

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      {asSelect ? (
        <select
          value={value}
          onChange={handleChange}
          className={inputClass}
          disabled={disabled}
        >
          {selectOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          inputMode={inputMode}
          placeholder={placeholder}
          type={type || "text"}
          className={inputClass}
          disabled={disabled}
        />
      )}
    </div>
  );
}
