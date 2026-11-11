import { useState, useEffect } from "react";
import { pickPaymentProperty } from "@/components/Payments/PaymentPropertyField";

export function useUpfrontPaymentForm(defaultDate, allTenants = []) {
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState(""); // Display name for auto-filled property
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [mustChooseProperty, setMustChooseProperty] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MTN MoMo");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");

  // When tenant is selected, auto-populate property from their active lease.
  // If they have active leases at more than one property, the user must
  // choose (credit is scoped per property and never crosses properties).
  useEffect(() => {
    const tenant =
      tenantId && allTenants.length > 0
        ? allTenants.find((t) => String(t.id) === String(tenantId))
        : null;
    const picked = pickPaymentProperty(tenant);
    setPropertyId(picked.propertyId);
    setPropertyName(picked.propertyName);
    setPropertyOptions(picked.options);
    setMustChooseProperty(picked.mustChoose);
    setAmount("");
  }, [tenantId, allTenants]);

  const reset = () => {
    setPropertyId("");
    setPropertyName("");
    setPropertyOptions([]);
    setMustChooseProperty(false);
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
    propertyOptions,
    mustChooseProperty,
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
