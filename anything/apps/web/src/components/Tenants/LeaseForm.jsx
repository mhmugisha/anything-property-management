import { useState, useMemo, useCallback, useEffect } from "react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";
import { Search, X } from "lucide-react";
import {
  formatNumberWithCommas,
  normalizeNumberInput,
} from "@/utils/formatNumberInput";

export function LeaseForm({
  leaseForm,
  onChange,
  landlordOptions,
  propertyOptions,
  unitOptions,
  onLandlordChange,
  onPropertyChange,
  onUnitChange,
}) {
  const [rentFocused, setRentFocused] = useState(false);
  const [landlordSearch, setLandlordSearch] = useState("");
  const [showLandlordDropdown, setShowLandlordDropdown] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

  // Clear property search text when property_id is externally reset (e.g. landlord changed)
  useEffect(() => {
    if (!leaseForm.property_id) {
      setPropertySearch("");
    }
  }, [leaseForm.property_id]);

  // Clear landlord search text when landlord_id is externally reset
  useEffect(() => {
    if (!leaseForm.landlord_id) {
      setLandlordSearch("");
    }
  }, [leaseForm.landlord_id]);

  const normalizeDateValue = (value) => {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "string") {
      if (value.length >= 10) return value.slice(0, 10);
      return "";
    }
    return "";
  };

  const startValue = normalizeDateValue(leaseForm.start_date);
  const endValue = normalizeDateValue(leaseForm.end_date);

  const monthlyRentRaw = normalizeNumberInput(leaseForm.monthly_rent, {
    allowDecimal: false,
  });

  const monthlyRentDisplay = rentFocused
    ? monthlyRentRaw
    : formatNumberWithCommas(monthlyRentRaw, { allowDecimal: false });

  // Filter landlords based on search
  const filteredLandlords = useMemo(() => {
    if (!landlordSearch.trim()) return landlordOptions;
    const lower = landlordSearch.toLowerCase();
    return landlordOptions.filter((l) =>
      (l.label || "").toLowerCase().includes(lower),
    );
  }, [landlordOptions, landlordSearch]);

  // Filter properties based on search
  const filteredProperties = useMemo(() => {
    if (!propertySearch.trim()) return propertyOptions;
    const lower = propertySearch.toLowerCase();
    return propertyOptions.filter((p) =>
      (p.name || "").toLowerCase().includes(lower),
    );
  }, [propertyOptions, propertySearch]);

  const selectedLandlord = useMemo(() => {
    if (!leaseForm.landlord_id) return null;
    return (
      landlordOptions.find((l) => l.id === Number(leaseForm.landlord_id)) ||
      null
    );
  }, [landlordOptions, leaseForm.landlord_id]);

  const selectedProperty = useMemo(() => {
    if (!leaseForm.property_id) return null;
    return (
      propertyOptions.find((p) => p.id === Number(leaseForm.property_id)) ||
      null
    );
  }, [propertyOptions, leaseForm.property_id]);

  const onSelectLandlord = useCallback(
    (landlord) => {
      onLandlordChange(String(landlord.id));
      setLandlordSearch(landlord.label || "");
      setShowLandlordDropdown(false);
    },
    [onLandlordChange],
  );

  const onClearLandlord = useCallback(() => {
    onLandlordChange("");
    setLandlordSearch("");
  }, [onLandlordChange]);

  const onSelectProperty = useCallback(
    (prop) => {
      onPropertyChange(String(prop.id));
      setPropertySearch(prop.name || "");
      setShowPropertyDropdown(false);
    },
    [onPropertyChange],
  );

  const onClearProperty = useCallback(() => {
    onPropertyChange("");
    setPropertySearch("");
  }, [onPropertyChange]);

  const landlordDropdownVisible =
    showLandlordDropdown && filteredLandlords.length > 0;
  const propertyDropdownVisible =
    showPropertyDropdown && filteredProperties.length > 0;

  return (
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
              placeholder="Search landlord…"
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
            {leaseForm.landlord_id && (
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
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filteredLandlords.map((l) => {
                const isSelected = l.id === Number(leaseForm.landlord_id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onSelectLandlord(l)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                      isSelected ? "bg-sky-50 font-medium" : ""
                    }`}
                  >
                    <div className="font-medium text-slate-800">{l.label}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Field>

      <Field label="Property">
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={propertySearch}
              onChange={(e) => {
                setPropertySearch(e.target.value);
                setShowPropertyDropdown(true);
                if (!e.target.value.trim()) onClearProperty();
              }}
              onFocus={() => setShowPropertyDropdown(true)}
              placeholder="Search property…"
              disabled={!leaseForm.landlord_id}
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {leaseForm.property_id && (
              <button
                type="button"
                onClick={onClearProperty}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {propertyDropdownVisible && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filteredProperties.map((p) => {
                const isSelected = p.id === Number(leaseForm.property_id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProperty(p)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                      isSelected ? "bg-sky-50 font-medium" : ""
                    }`}
                  >
                    <div className="font-medium text-slate-800">{p.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Field>

      {/* Close dropdowns on outside click */}
      {landlordDropdownVisible && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowLandlordDropdown(false)}
        />
      )}
      {propertyDropdownVisible && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowPropertyDropdown(false)}
        />
      )}

      <Field label="Vacant unit">
        <select
          value={leaseForm.unit_id}
          onChange={(e) => onUnitChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          disabled={!leaseForm.property_id}
        >
          <option value="">Select unit…</option>
          {unitOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Start date">
        <DatePopoverInput
          value={startValue}
          onChange={(val) => onChange({ ...leaseForm, start_date: val })}
          placeholder="DD-MM-YYYY"
        />
      </Field>

      <Field label="End Lease Date (Optional)">
        <DatePopoverInput
          value={endValue}
          onChange={(val) => onChange({ ...leaseForm, end_date: val })}
          placeholder="DD-MM-YYYY"
        />
      </Field>

      <Field label="Monthly rent (UGX)">
        <input
          type="text"
          inputMode="numeric"
          value={monthlyRentDisplay}
          onFocus={() => setRentFocused(true)}
          onBlur={() => setRentFocused(false)}
          onChange={(e) =>
            onChange({
              ...leaseForm,
              monthly_rent: normalizeNumberInput(e.target.value, {
                allowDecimal: false,
              }),
            })
          }
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
        />
      </Field>

      <Field label="Security Deposit (Optional)">
        <input
          type="number"
          value={leaseForm.deposit_amount}
          onChange={(e) =>
            onChange({ ...leaseForm, deposit_amount: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
        />
      </Field>
    </div>
  );
}
