"use client";

import { useCallback, useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import PaymentsSidebar from "@/components/Shell/PaymentsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useCreatePayment } from "@/hooks/usePayments";
import { usePaymentFilters } from "@/hooks/usePaymentFilters";
import { useInvoicePaymentForm } from "@/hooks/useInvoicePaymentForm";
import { useTenantLookup, useDueInvoices } from "@/hooks/usePaymentLookups";
import { InvoicePaymentForm } from "@/components/Payments/InvoicePaymentForm";

export default function PayInvoicePage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const canManagePayments = staffQuery.data?.permissions?.payments === true;

  const filters = usePaymentFilters();

  const createPaymentMutation = useCreatePayment();

  const handleClearError = useCallback(() => {
    createPaymentMutation.reset();
  }, [createPaymentMutation]);

  const [invoiceTenantId, setInvoiceTenantId] = useState("");

  // Fetch ALL tenants (no property filter)
  const invTenantLookupQuery = useTenantLookup(
    null, // No propertyId filter
    !userLoading && !!user,
  );

  const tenantDueInvoicesQuery = useDueInvoices(
    invoiceTenantId,
    !userLoading && !!user && canManagePayments,
  );

  const tenantDueInvoices = tenantDueInvoicesQuery.data || [];
  const allTenants = invTenantLookupQuery.data || [];

  const invoiceForm = useInvoicePaymentForm(
    filters.defaultTo,
    tenantDueInvoices,
    allTenants, // Pass all tenants for auto-population
  );

  if (invoiceForm.tenantId !== invoiceTenantId) {
    setInvoiceTenantId(invoiceForm.tenantId);
  }

  const onSubmitInvoicePayment = useCallback(() => {
    const payload = invoiceForm.getPayload();

    createPaymentMutation.mutate(payload, {
      onSuccess: () => {
        invoiceForm.reset();
        setSuccessMessage("Payment saved successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
      },
    });
  }, [invoiceForm, createPaymentMutation]);

  const handleCancel = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/payments";
    }
  };

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

  if (!canManagePayments) {
    return (
      <AccessDenied
        title="Payments"
        message="You don't have access to record or view payments."
      />
    );
  }

  const isSaving = createPaymentMutation.isPending;
  const createError = createPaymentMutation.error;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Pay Invoice"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="payments"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="payments"
      />
      <Sidebar active="payments">
        <PaymentsSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 max-w-[90%] mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-800">
              Payment on Invoice
            </h1>
            <p className="text-slate-500 mt-2">
              Record a payment against an existing invoice
            </p>
          </div>

          {successMessage ? (
            <div className="max-w-[960px] mx-auto mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 text-center font-medium">
              {successMessage}
            </div>
          ) : null}

          <div className="max-w-[960px] mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <InvoicePaymentForm
              form={invoiceForm}
              tenants={allTenants}
              dueInvoices={tenantDueInvoices}
              tenantsLoading={invTenantLookupQuery.isLoading}
              invoicesLoading={tenantDueInvoicesQuery.isLoading}
              onSubmit={onSubmitInvoicePayment}
              onCancel={handleCancel}
              isSaving={isSaving}
              error={createError}
              onClearError={handleClearError}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
