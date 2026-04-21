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

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);

  const canSubmit =
    !!invoiceId &&
    !!tenantId &&
    !!date &&
    String(amount || "").length > 0 &&
    Number(amount) > 0;

  // Filter tenants based on search
  const filteredTenants = useMemo(() => {
    if (!tenantSearch.trim()) return tenants;
    const lower = tenantSearch.toLowerCase();
    return tenants.filter(
      (t) =>
        (t.full_name || "").toLowerCase().includes(lower) ||
        (t.phone || "").toLowerCase().includes(lower),
    );
  }, [tenants, tenantSearch]);

  // Filter invoices based on selected tenant and search
  const filteredInvoices = useMemo(() => {
    if (!tenantId) return [];
    let filtered = (invoices || []).filter(
      (inv) => inv.tenant_id === Number(tenantId),
    );
    if (invoiceSearch.trim()) {
      const lower = invoiceSearch.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          (inv.description || "").toLowerCase().includes(lower) ||
          String(inv.amount || "").includes(lower),
      );
    }
    return filtered;
  }, [invoices, tenantId, invoiceSearch]);

  const selectedInvoice = useMemo(() => {
    if (!invoiceId) return null;
    return (invoices || []).find((inv) => inv.id === Number(invoiceId)) || null;
  }, [invoices, invoiceId]);

  // Calculate unpaid balance for selected invoice
  const unpaidBalance = useMemo(() => {
    if (!selectedInvoice) return 0;
    const invoiceAmount = Number(selectedInvoice.amount) || 0;
    const paidAmount = Number(selectedInvoice.paid_amount) || 0;
    return invoiceAmount - paidAmount;
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
    (invoice) => {
      onInvoiceChange(String(invoice.id));
      const unpaidBal =
        (Number(invoice.amount) || 0) - (Number(invoice.paid_amount) || 0);
      setInvoiceSearch(
        `${invoice.description} - Balance: ${unpaidBal.toLocaleString()} ${invoice.currency}`,
      );
      setShowInvoiceDropdown(false);
      // Auto-populate amount with UNPAID BALANCE and currency from selected invoice
      onAmountChange(String(unpaidBal));
    },
    [onInvoiceChange, onAmountChange],
  );

  const onClearInvoice = useCallback(() => {
    onInvoiceChange("");
    setInvoiceSearch("");
    onAmountChange("");
  }, [onInvoiceChange, onAmountChange]);

  const tenantDropdownVisible =
    showTenantDropdown && filteredTenants.length > 0;
  const invoiceDropdownVisible =
    showInvoiceDropdown && filteredInvoices.length > 0;

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
                        <div className="font-medium text-slate-800">
                          {label}
                        </div>
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

        {/* Row 2: Invoice to Reverse — full width */}
        <Field label="Invoice to Reverse" required>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => {
                  setInvoiceSearch(e.target.value);
                  setShowInvoiceDropdown(true);
                  if (!e.target.value.trim()) onClearInvoice();
                }}
                onFocus={() => setShowInvoiceDropdown(true)}
                placeholder={
                  tenantId ? "Search invoice…" : "Select tenant first"
                }
                disabled={!tenantId}
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500 text-sm disabled:bg-gray-100 disabled:text-gray-400"
              />
              {invoiceId && (
                <button
                  type="button"
                  onClick={onClearInvoice}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {invoiceDropdownVisible && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {filteredInvoices.map((inv) => {
                  const isSelected = inv.id === Number(invoiceId);
                  const invoiceAmt = Number(inv.amount) || 0;
                  const paidAmt = Number(inv.paid_amount) || 0;
                  const unpaidBal = invoiceAmt - paidAmt;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => onSelectInvoice(inv)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                        isSelected ? "bg-sky-50 font-medium" : ""
                      }`}
                    >
                      <div className="font-medium text-slate-800">
                        {inv.description}
                      </div>
                      <div className="text-xs text-slate-500">
                        Invoice: {invoiceAmt.toLocaleString()} {inv.currency} •
                        Paid: {paidAmt.toLocaleString()} •
                        <span className="font-semibold text-amber-600">
                          {" "}
                          Balance: {unpaidBal.toLocaleString()}
                        </span>{" "}
                        • Due: {new Date(inv.due_date).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Field>

        {/* Row 3: Unpaid balance info box */}
        {selectedInvoice && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-700">
                Unpaid Balance Available to Reverse:
              </span>
              <span className="font-semibold text-amber-700">
                {unpaidBalance.toLocaleString()} {selectedInvoice.currency}
              </span>
            </div>
            {Number(selectedInvoice.paid_amount) > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                (Invoice: {Number(selectedInvoice.amount).toLocaleString()}{" "}
                {selectedInvoice.currency}, Paid:{" "}
                {Number(selectedInvoice.paid_amount).toLocaleString()}{" "}
                {selectedInvoice.currency})
              </div>
            )}
          </div>
        )}

        {/* Row 4: Amount | Reversal Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Amount" required>
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Enter amount to reverse"
              step="0.01"
              min="0"
            />
          </Field>

          <Field label="Reversal Date">
            <DatePopoverInput
              value={date}
              onChange={onDateChange}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
        </div>

        {/* Row 5: Description — full width */}
        <Field label="Description (Optional)">
          <input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            placeholder="e.g. Invoice reversal"
          />
        </Field>
      </div>

      {/* Close dropdowns on outside click */}
      {tenantDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowTenantDropdown(false)}
        />
      )}
      {invoiceDropdownVisible && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowInvoiceDropdown(false)}
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
