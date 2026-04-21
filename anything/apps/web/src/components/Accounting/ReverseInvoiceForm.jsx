import { useState, useMemo, useCallback } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Field } from "./Field";
import DatePopoverInput from "@/components/DatePopoverInput";

export function ReverseInvoiceForm({
  propertyId,
  tenantId,
  invoiceId,
  date,
  description,
  amount,
  properties,
  tenants,
  invoices,
  onTenantChange,
  onInvoiceChange,
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
    !!invoiceId &&
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

  const filteredInvoices = useMemo(() => {
    if (!tenantId) return [];
    return (invoices || []).filter(
      (inv) => inv.tenant_id === Number(tenantId),
    );
  }, [invoices, tenantId]);

  const selectedInvoice = useMemo(() => {
    if (!invoiceId) return null;
    return (invoices || []).find((inv) => inv.id === Number(invoiceId)) || null;
  }, [invoices, invoiceId]);

  const amountDisplay = useMemo(() => {
    if (!selectedInvoice) return "";
    const unpaidBal =
      (Number(selectedInvoice.amount) || 0) -
      (Number(selectedInvoice.paid_amount) || 0);
    return unpaidBal > 0
      ? `${unpaidBal.toLocaleString()} ${selectedInvoice.currency}`
      : "";
  }, [selectedInvoice]);

  const onSelectTenant = useCallback(
    (tenant) => {
      onTenantChange(String(tenant.id));
      const title = tenant.title ? `${tenant.title} ` : "";
      setTenantSearch(`${title}${tenant.full_name} (${tenant.phone})`);
      const unitPart = tenant.current_unit_number
        ? ` - Unit ${tenant.current_unit_number}`
        : "";
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

  const onSelectInvoice = useCallback(
    (invoiceIdStr) => {
      if (!invoiceIdStr) {
        onInvoiceChange("");
        onAmountChange("");
        return;
      }
      const invoice = (invoices || []).find(
        (inv) => String(inv.id) === invoiceIdStr,
      );
      if (!invoice) return;
      onInvoiceChange(invoiceIdStr);
      const unpaidBal =
        (Number(invoice.amount) || 0) - (Number(invoice.paid_amount) || 0);
      // Auto-populate amount with UNPAID BALANCE
      onAmountChange(String(unpaidBal));
    },
    [invoices, onInvoiceChange, onAmountChange],
  );

  const tenantDropdownVisible =
    showTenantDropdown && filteredTenants.length > 0;

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">
        Reverse Rent Invoice
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
                        <div className="font-medium text-slate-800">{label}</div>
                        {(t.current_property_name || t.current_unit_number) && (
                          <div className="text-xs text-slate-500">
                            {t.current_property_name}
                            {t.current_unit_number
                              ? ` - Unit ${t.current_unit_number}`
                              : ""}
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

        {/* Row 2: Invoice to Reverse dropdown | Amount read-only */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Invoice to Reverse">
            <select
              value={invoiceId}
              onChange={(e) => onSelectInvoice(e.target.value)}
              disabled={!tenantId}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none disabled:bg-gray-100 disabled:text-gray-400"
            >
              {!tenantId ? (
                <option value="">Select tenant first</option>
              ) : (
                <option value="">Select invoice…</option>
              )}
              {filteredInvoices.map((inv) => {
                const invoiceAmt = Number(inv.amount) || 0;
                const paidAmt = Number(inv.paid_amount) || 0;
                const unpaidBal = invoiceAmt - paidAmt;
                return (
                  <option key={inv.id} value={String(inv.id)}>
                    {inv.description} — Balance: {unpaidBal.toLocaleString()} {inv.currency}
                  </option>
                );
              })}
            </select>
          </Field>

          <Field label="Amount">
            <input
              type="text"
              value={amountDisplay}
              readOnly
              placeholder="Auto-filled after invoice selection"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-slate-600 text-sm outline-none cursor-default"
            />
          </Field>
        </div>

        {/* Row 3: Reversal Date | Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Reversal Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>

          <Field label="Description (Optional)">
            <input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder="e.g. Invoice reversal"
            />
          </Field>
        </div>
      </div>

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
          <RotateCcw className="w-4 h-4" />
          {isPending ? "Reversing..." : "Reverse Invoice"}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-500 text-center">
        Reverses the unpaid balance of a rent invoice. Creates accounting entry:
        Debit Due to Landlords, Credit Rent Receivable. Note: Management fees
        are NOT reversed.
      </div>
    </div>
  );
}
