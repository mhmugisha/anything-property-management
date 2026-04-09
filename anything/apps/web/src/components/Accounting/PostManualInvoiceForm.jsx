import { useState, useMemo, useCallback } from "react";
import { Save, Search, X } from "lucide-react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function PostManualInvoiceForm({
  leaseId,
  date,
  description,
  amount,
  currency,
  leases,
  onLeaseChange,
  onDateChange,
  onDescriptionChange,
  onAmountChange,
  onSubmit,
  isPending,
}) {
  const [leaseSearch, setLeaseSearch] = useState("");
  const [showLeaseDropdown, setShowLeaseDropdown] = useState(false);

  const canSubmit =
    !!leaseId &&
    !!date &&
    !!description.trim() &&
    String(amount || "").length > 0 &&
    Number(amount) > 0;

  // Filter leases based on search
  const filteredLeases = useMemo(() => {
    if (!leaseSearch.trim()) return leases;
    const lower = leaseSearch.toLowerCase();
    return leases.filter(
      (l) =>
        (l.tenant_name || "").toLowerCase().includes(lower) ||
        (l.property_name || "").toLowerCase().includes(lower) ||
        (l.unit_number || "").toLowerCase().includes(lower),
    );
  }, [leases, leaseSearch]);

  const selectedLease = useMemo(() => {
    if (!leaseId) return null;
    return leases.find((l) => l.id === Number(leaseId)) || null;
  }, [leases, leaseId]);

  const onSelectLease = useCallback(
    (lease) => {
      onLeaseChange(String(lease.id));
      const tenantTitle = lease.tenant_title ? `${lease.tenant_title} ` : "";
      setLeaseSearch(
        `${tenantTitle}${lease.tenant_name} - ${lease.property_name} - Unit ${lease.unit_number}`,
      );
      setShowLeaseDropdown(false);
    },
    [onLeaseChange],
  );

  const onClearLease = useCallback(() => {
    onLeaseChange("");
    setLeaseSearch("");
  }, [onLeaseChange]);

  const leaseDropdownVisible = showLeaseDropdown && filteredLeases.length > 0;

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">
        Post Manual Invoice
      </h3>

      <div className="space-y-3">
        {/* Two-column grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Row 1, Col 1 - Tenant dropdown */}
          <Field label="Tenant">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={leaseSearch}
                  onChange={(e) => {
                    setLeaseSearch(e.target.value);
                    setShowLeaseDropdown(true);
                    if (!e.target.value.trim()) onClearLease();
                  }}
                  onFocus={() => setShowLeaseDropdown(true)}
                  placeholder="Search lease by tenant, property, or unit…"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                />
                {leaseId && (
                  <button
                    type="button"
                    onClick={onClearLease}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {leaseDropdownVisible && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredLeases.map((l) => {
                    const isSelected = l.id === Number(leaseId);
                    const tenantTitle = l.tenant_title
                      ? `${l.tenant_title} `
                      : "";
                    const label = `${tenantTitle}${l.tenant_name} - ${l.property_name} - Unit ${l.unit_number}`;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onSelectLease(l)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                          isSelected ? "bg-sky-50 font-medium" : ""
                        }`}
                      >
                        <div className="font-medium text-slate-800">
                          {label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {l.currency || "UGX"}{" "}
                          {Number(l.monthly_rent || 0).toLocaleString()} / month
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>

          {/* Row 1, Col 2 - Invoice Date */}
          <Field label="Invoice Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>

          {/* Row 2, Col 1 - Description */}
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. Water charges - March 2026, Electricity - March 2026"
            />
          </Field>

          {/* Row 2, Col 2 - Amount */}
          <Field label="Amount">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. 100000"
            />
          </Field>
        </div>

        {/* Currency display (auto-filled) - outside grid, full width */}
        {selectedLease && (
          <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-800">
            <strong>Currency:</strong> {currency}
          </div>
        )}
      </div>

      {/* Close dropdown on outside click */}
      {leaseDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowLeaseDropdown(false)}
        />
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !canSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Saving..." : "Post Invoice"}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center">
        Description is required and will appear on tenant statements and
        landlord payment notes
      </div>
    </div>
  );
}
