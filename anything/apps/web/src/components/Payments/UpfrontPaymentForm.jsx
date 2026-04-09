import { Save } from "lucide-react";
import { useEffect, useMemo } from "react";
import DatePopoverInput from "@/components/DatePopoverInput";
import { Field } from "./Field";

export function UpfrontPaymentForm({
  form,
  tenants,
  tenantsLoading,
  onSubmit,
  onCancel,
  isSaving,
  error,
  onClearError,
}) {
  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        if (onClearError) {
          onClearError();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, onClearError]);

  // Filter tenants based on search text
  const filteredTenants = useMemo(() => {
    if (!form.tenantSearch) return tenants;
    const searchLower = form.tenantSearch.toLowerCase();
    return tenants.filter((t) => {
      const fullName = (t.full_name || "").toLowerCase();
      const phone = (t.phone || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const propertyName = (t.current_property_name || "").toLowerCase();
      return (
        fullName.includes(searchLower) ||
        phone.includes(searchLower) ||
        email.includes(searchLower) ||
        propertyName.includes(searchLower)
      );
    });
  }, [tenants, form.tenantSearch]);

  const handleTenantSelect = (tenant) => {
    form.setTenantId(tenant.id);
    form.setTenantSearch(`${tenant.full_name} (${tenant.phone})`);
    form.setShowTenantDropdown(false);
  };

  const handleTenantSearchChange = (e) => {
    form.setTenantSearch(e.target.value);
    form.setShowTenantDropdown(true);
    // Clear selection when user starts typing
    if (form.tenantId) {
      form.setTenantId("");
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-slate-800 mb-6 text-center">
        Payment on Account
      </h2>

      <div className="space-y-3">
        {/* Row 1 - Tenant with search */}
        <Field label="Select Tenant">
          <div className="relative">
            <input
              type="text"
              value={form.tenantSearch}
              onChange={handleTenantSearchChange}
              onFocus={() => form.setShowTenantDropdown(true)}
              placeholder="Type to search tenants..."
              disabled={tenantsLoading}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
            />
            {form.showTenantDropdown && filteredTenants.length > 0 && (
              <div className="absolute z-10 mt-1 w-full border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white shadow-lg">
                {filteredTenants.slice(0, 6).map((t) => {
                  const propertyInfo = t.current_property_name
                    ? ` • ${t.current_property_name}`
                    : " • No active lease";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTenantSelect(t)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 text-sm"
                    >
                      {t.full_name} ({t.phone}){propertyInfo}
                    </button>
                  );
                })}
              </div>
            )}
            {form.showTenantDropdown &&
              form.tenantSearch &&
              filteredTenants.length === 0 && (
                <div className="absolute z-10 mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-slate-500 text-xs">
                  No tenants found
                </div>
              )}
          </div>
        </Field>

        {/* Row 2 - Auto-populated Property (read-only) */}
        <Field label="Property (Auto-filled)">
          <input
            type="text"
            value={
              form.propertyName || (form.tenantId ? "No active lease" : "")
            }
            readOnly
            placeholder={form.tenantId ? "" : "Select tenant first..."}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none text-sm text-slate-600"
          />
        </Field>

        {/* Row 3 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount Paid (UGX)">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => form.setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. 500000"
            />
          </Field>

          <Field label="Payment Date">
            <DatePopoverInput
              value={form.paymentDate}
              onChange={form.setPaymentDate}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <select
              value={form.paymentMethod}
              onChange={(e) => form.setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="MTN MoMo">MTN MoMo</option>
              <option value="Airtel Money">Airtel Money</option>
            </select>
          </Field>

          <Field label="Ref. (Optional)">
            <input
              value={form.receiptNumber}
              onChange={(e) => form.setReceiptNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. RCT-001"
            />
          </Field>
        </div>

        {/* Row 5 - Notes */}
        <Field label="Notes (Optional)">
          <input
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
          />
        </Field>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {error?.message ||
            "Could not record upfront payment. Please check inputs."}
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
          onClick={onSubmit}
          disabled={isSaving || !form.isValid()}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Payment"}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        Payments on account are automatically allocated to outstanding invoices
        starting from the oldest. Any remaining amount is held as tenant credit
        for future invoices.
      </div>
    </div>
  );
}
