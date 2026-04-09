import { useState, useMemo, useCallback } from "react";

function iso(d) {
  if (!d) return "";
  try {
    return String(d).slice(0, 10);
  } catch {
    return "";
  }
}

export function useLandlordForm(initialForm) {
  const [form, setForm] = useState(initialForm);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const canSave = useMemo(() => {
    const hasFullName = !!form.full_name;
    if (!hasFullName) return false;

    const method = form.payment_method || "";
    const requiresMethod = isCreating === true;

    const methodOk = requiresMethod
      ? method === "bank" || method === "mobile_money"
      : method === "" || method === "bank" || method === "mobile_money";

    const bankOk =
      method !== "bank" ||
      (!!form.bank_name &&
        !!form.bank_account_title &&
        !!form.bank_account_number);

    const mmOk =
      method !== "mobile_money" ||
      (!!form.mobile_money_name && !!form.mobile_money_phone);

    return methodOk && bankOk && mmOk;
  }, [
    isCreating,
    form.full_name,
    form.payment_method,
    form.bank_name,
    form.bank_account_title,
    form.bank_account_number,
    form.mobile_money_name,
    form.mobile_money_phone,
  ]);

  const startCreate = useCallback(() => {
    setIsCreating(true);
    setIsEditing(false);
    setForm(initialForm);
  }, [initialForm]);

  const startEdit = useCallback((landlord) => {
    if (!landlord) return;
    setIsCreating(false);
    setIsEditing(true);
    setForm({
      full_name: landlord.full_name || "",
      title: landlord.title || "",
      phone: landlord.phone || "",
      email: landlord.email || "",
      due_day:
        landlord.due_day !== null && landlord.due_day !== undefined
          ? String(landlord.due_day)
          : "",
      start_date: iso(landlord.start_date),
      end_date: iso(landlord.end_date),
      payment_method: landlord.payment_method || "",
      bank_name: landlord.bank_name || "",
      bank_account_title: landlord.bank_account_title || "",
      bank_account_number: landlord.bank_account_number || "",
      mobile_money_name: landlord.mobile_money_name || "",
      mobile_money_phone: landlord.mobile_money_phone || "",
    });
  }, []);

  const cancel = useCallback(() => {
    setIsCreating(false);
    setIsEditing(false);
    setForm(initialForm);
  }, [initialForm]);

  const reset = useCallback(() => {
    setForm(initialForm);
  }, [initialForm]);

  return {
    form,
    setForm,
    isCreating,
    isEditing,
    canSave,
    startCreate,
    startEdit,
    cancel,
    reset,
    setIsCreating,
    setIsEditing,
  };
}
