import { useState, useEffect } from "react";

export function useDeleteInvoice() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const deleteInvoice = async (invoiceId) => {
    if (!invoiceId) {
      setError("Invoice ID is required");
      return { ok: false, error: "Invoice ID is required" };
    }

    // Confirm deletion
    const confirmed = window.confirm(
      "Are you sure you want to delete this invoice? This action cannot be undone easily.",
    );

    if (!confirmed) {
      return { ok: false, cancelled: true };
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to delete invoice");
        return { ok: false, error: data.error };
      }

      setIsDeleting(false);
      return { ok: true, data };
    } catch (err) {
      const errorMessage = err.message || "Failed to delete invoice";
      setError(errorMessage);
      setIsDeleting(false);
      return { ok: false, error: errorMessage };
    }
  };

  return {
    deleteInvoice,
    isDeleting,
    error,
  };
}
