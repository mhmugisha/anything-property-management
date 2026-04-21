"use client";

import { useState, useCallback, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { ReverseInvoiceForm } from "@/components/Accounting/ReverseInvoiceForm";
import { useAccountingLookups } from "@/hooks/useAccountingLookups";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReverseInvoicePage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UGX");

  const lookups = useAccountingLookups(
    !userLoading && !!user && canUseAccounting,
    {
      tenantPropertyId: propertyId,
    },
  );

  // Fetch invoices for selected tenant
  const invoicesQuery = useQuery({
    queryKey: ["tenant-invoices", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const response = await fetch(`/api/invoices/due?tenantId=${tenantId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.invoices || [];
    },
    enabled: !!tenantId && canUseAccounting,
  });

  const reverseInvoiceMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await fetch("/api/accounting/reverse-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to reverse invoice");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-invoices"] });
      setInvoiceId("");
      setDescription("");
      setAmount("");

      // Create detailed success message with new fields
      const reversalType = data.reversal_type === "full" ? "Full" : "Partial";

      let message = `${reversalType} reversal successful! `;
      message += `Unpaid balance was: ${data.unpaid_balance_before_reversal?.toLocaleString()} ${currency}, `;
      message += `Reversed: ${data.reversed_amount?.toLocaleString()} ${currency}`;

      if (data.reversal_type === "partial") {
        message += `, Remaining unpaid: ${data.remaining_unpaid_balance?.toLocaleString()} ${currency}`;
        message += `, New invoice total: ${data.new_invoice_amount?.toLocaleString()} ${currency}`;
      } else {
        message += `. Invoice marked as void.`;
      }

      setSuccessMessage(message);
    },
  });

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Auto-dismiss error message after 3 seconds
  useEffect(() => {
    if (reverseInvoiceMutation.error) {
      const timer = setTimeout(() => {
        reverseInvoiceMutation.reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [reverseInvoiceMutation.error, reverseInvoiceMutation]);

  const onPropertyChange = useCallback((next) => {
    setPropertyId(next);
    setTenantId("");
    setInvoiceId("");
  }, []);

  const onTenantChange = useCallback((next) => {
    setTenantId(next);
    setInvoiceId("");
  }, []);

  const onSubmit = useCallback(() => {
    // Clear any previous messages
    setSuccessMessage(null);
    reverseInvoiceMutation.reset();

    const payload = {
      invoice_id: invoiceId ? Number(invoiceId) : null,
      property_id: propertyId ? Number(propertyId) : null,
      tenant_id: tenantId ? Number(tenantId) : null,
      reversal_date: date,
      description,
      amount: amount === "" ? null : Number(amount),
      currency,
    };

    reverseInvoiceMutation.mutate(payload);
  }, [
    invoiceId,
    propertyId,
    tenantId,
    date,
    description,
    amount,
    currency,
    reverseInvoiceMutation,
  ]);

  const isLoading = userLoading || staffQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
    return null;
  }

  if (!staffQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/onboarding";
    return null;
  }

  if (!canUseAccounting) {
    return (
      <AccessDenied
        title="Reverse Invoice"
        message="You don't have access to the accounting module."
      />
    );
  }

  const properties = lookups.properties || [];
  const tenants = lookups.tenants || [];
  const invoices = invoicesQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Reverse Invoice"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 max-w-[90%] mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-800">
              Reverse Rent Invoice
            </h1>
            <p className="text-slate-500 mt-2">
              Reverse a rent invoice (partial or full amount)
            </p>
          </div>

          <div className="max-w-[960px] mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <ReverseInvoiceForm
              propertyId={propertyId}
              tenantId={tenantId}
              invoiceId={invoiceId}
              date={date}
              description={description}
              amount={amount}
              properties={properties}
              tenants={tenants}
              invoices={invoices}
              onTenantChange={onTenantChange}
              onInvoiceChange={setInvoiceId}
              onDateChange={setDate}
              onDescriptionChange={setDescription}
              onAmountChange={setAmount}
              onSubmit={onSubmit}
              isPending={reverseInvoiceMutation.isPending}
            />
          </div>

          {successMessage ? (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {reverseInvoiceMutation.error ? (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {reverseInvoiceMutation.error?.message ||
                "Could not reverse invoice."}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
