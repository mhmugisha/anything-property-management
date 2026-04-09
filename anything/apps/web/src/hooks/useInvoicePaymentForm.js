import { useState, useEffect, useMemo } from "react";

export function useInvoicePaymentForm(
  defaultDate,
  dueInvoices,
  allTenants = [],
) {
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState(""); // Display name for auto-filled property
  const [tenantId, setTenantId] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MTN MoMo");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");

  // When tenant is selected, auto-populate property from their current lease
  useEffect(() => {
    if (tenantId && allTenants.length > 0) {
      const tenant = allTenants.find((t) => String(t.id) === String(tenantId));
      if (tenant && tenant.current_property_id) {
        setPropertyId(String(tenant.current_property_id));
        setPropertyName(tenant.current_property_name || "");
      } else {
        // Tenant has no active lease
        setPropertyId("");
        setPropertyName("");
      }
    } else {
      setPropertyId("");
      setPropertyName("");
    }
    setInvoiceId("");
    setAmount("");
  }, [tenantId, allTenants]);

  useEffect(() => {
    setInvoiceId("");
    setAmount("");
  }, [propertyId]);

  const selectedInvoice = useMemo(() => {
    return dueInvoices.find((i) => String(i.id) === String(invoiceId)) || null;
  }, [dueInvoices, invoiceId]);

  useEffect(() => {
    if (!selectedInvoice) return;
    const out = Number(selectedInvoice.outstanding || 0);
    setAmount(String(out));
  }, [selectedInvoice]);

  const reset = () => {
    setPropertyId("");
    setPropertyName("");
    setTenantId("");
    setTenantSearch("");
    setShowTenantDropdown(false);
    setInvoiceId("");
    setAmount("");
    setReceiptNumber("");
    setNotes("");
  };

  const getPayload = () => ({
    invoice_id: Number(invoiceId),
    payment_date: paymentDate,
    amount: Number(amount),
    payment_method: paymentMethod,
    reference_number: receiptNumber || null,
    notes: notes || null,
  });

  const isValid = () => {
    return propertyId && tenantId && invoiceId && amount;
  };

  return {
    propertyId,
    setPropertyId,
    propertyName,
    setPropertyName,
    tenantId,
    setTenantId,
    tenantSearch,
    setTenantSearch,
    showTenantDropdown,
    setShowTenantDropdown,
    invoiceId,
    setInvoiceId,
    paymentDate,
    setPaymentDate,
    amount,
    setAmount,
    paymentMethod,
    setPaymentMethod,
    receiptNumber,
    setReceiptNumber,
    notes,
    setNotes,
    selectedInvoice,
    reset,
    getPayload,
    isValid,
  };
}
