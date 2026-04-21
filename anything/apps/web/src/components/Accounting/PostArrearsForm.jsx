import { useState, useMemo, useCallback } from "react";
import { Save, Search, X } from "lucide-react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function PostArrearsForm({
  propertyId,
  tenantId,
  date,
  description,
  amount,
  properties,
  tenants,
  onPropertyChange,
  onTenantChange,
  onDateChange,
  onDescriptionChange,
  onAmountChange,
  onSubmit,
  isPending,
}) {
  const [tenantSearch, setTenantSearch] = useState("");
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [propertyDisplay, setPropertyDisplay] = useState("");

  const canSubmit =
    !!tenantId &&
    !!date &&
    String(amount || "").length > 0 &&
    Number(amount) > 0;

  const filteredTenants = useMemo(() => {
    if (!tenantSearch.trim()) return tenants;
    const lower = tenantSearch.toLowerCase();
    return tenants.filter(
      (t) =>
        (t.full_name || "").toLowerCase().includes(lower) ||
        (t.phone || "").toLowerCase().includes(lower),
    );
  }, [tenants, tenantSearch]);

  const onSelectTenant = useCallback(
    (tenant) => {
      onTenantChange(String(tenant.id));
      const title = tenant.title ? `${tenant.title} ` : "";
      setTenantSearch(`${title}${tenant.full_name} (${tenant.phone})`);
      const unitPart = tenant.current_unit_number ? ` - Unit ${tenant.current_unit_number}` : "";
      setPropertyDisplay(`${tenant.current_property_name || ""}${unitPart}`);
      setShowTenantDropdown(false);
    },
    [onTenantChange],
  );

  const onClearTenant = useCallback(() => {
    onTenantChange("");
    setTenantSearch("");
    setPropertyDisplay("");
  }, [onTenantChange]);

  const tenantDropdownVisible =
    showTenantDropdown && filteredTenants.length > 0;

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">
        Post Arrears
      </h3>

      <div className="space-y-3">
        {/* Row 1: Tenant search | Property read-only */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Tenant">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={tenantSearch}
                  onChange={(e) => {
                    setTenantSearch(e.target.value);
                    setShowTenantDropdown(true);
                    if (!e.target.value.trim()) onClearTenant();
                  }}
                  onFocus={() => setShowTenantDropdown(true)}
                  placeholder="Search tenant…"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
                {tenantId && (
                  <button
                    type="button"
                    onClick={onClearTenant}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {tenantDropdownVisible && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredTenants.map((t) => {
                    const isSelected = t.id === Number(tenantId);
                    const title = t.title ? `${t.title} ` : "";
                    const label = `${title}${t.full_name} (${t.phone})`;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTenant(t)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                          isSelected ? "bg-sky-50 font-medium" : ""
                        }`}
                      >
                        <div className="font-medium text-slate-800">
                          {label}
                        </div>
                        {(t.current_property_name || t.current_unit_number) && (
                          <div className="text-xs text-slate-500">
                            {t.current_property_name}{t.current_unit_number ? ` - Unit ${t.current_unit_number}` : ""}
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
            <input
              type="text"
              value={propertyDisplay}
              readOnly
              placeholder="Auto-filled after tenant selection"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-slate-600 text-sm outline-none cursor-default"
            />
          </Field>
        </div>

        {/* Row 2: Amount | Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Amount">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. 500000"
            />
          </Field>

          <Field label="Arrears Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
        </div>

        {/* Row 3: Description full width */}
        <Field label="Description (Optional)">
          <input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            placeholder="e.g. Outstanding balance"
          />
        </Field>
      </div>

      {/* Close dropdown on outside click */}
      {tenantDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowTenantDropdown(false)}
        />
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !canSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving..." : "Post Arrears"}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center">
        Create arrears invoices for tenants (included in rent totals for
        management fee calculation)
      </div>
    </div>
  );
}
