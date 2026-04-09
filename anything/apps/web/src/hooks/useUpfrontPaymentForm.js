import { useState, useEffect } from "react";

export function useUpfrontPaymentForm(defaultDate, allTenants = []) {
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState(""); // Display name for auto-filled property
  const [tenantId, setTenantId] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
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
    setAmount("");
  }, [tenantId, allTenants]);

  const reset = () => {
    setPropertyId("");
    setPropertyName("");
    setTenantId("");
    setTenantSearch("");
    setShowTenantDropdown(false);
    setAmount("");
    setReceiptNumber("");
    setNotes("");
  };

  const getPayload = () => ({
    tenant_id: Number(tenantId),
    property_id: Number(propertyId),
    payment_date: paymentDate,
    amount: Number(amount),
    payment_method: paymentMethod,
    reference_number: receiptNumber || null,
    notes: notes || null,
    description: "Payment on Account",
  });

  const isValid = () => {
    return propertyId && tenantId && amount;
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
    reset,
    getPayload,
    isValid,
  };
}
