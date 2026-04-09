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
import { useUpfrontPaymentForm } from "@/hooks/useUpfrontPaymentForm";
import { useTenantLookup } from "@/hooks/usePaymentLookups";
import { UpfrontPaymentForm } from "@/components/Payments/UpfrontPaymentForm";

export default function AdvancePaymentPage() {
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

  // Fetch ALL tenants (no property filter)
  const upfTenantLookupQuery = useTenantLookup(
    null, // No propertyId filter
    !userLoading && !!user,
  );

  const allTenants = upfTenantLookupQuery.data || [];

  const upfrontForm = useUpfrontPaymentForm(filters.defaultTo, allTenants);

  const onSubmitUpfrontPayment = useCallback(() => {
    const payload = upfrontForm.getPayload();

    createPaymentMutation.mutate(payload, {
      onSuccess: () => {
        upfrontForm.reset();
        setSuccessMessage("Payment saved successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
      },
    });
  }, [upfrontForm, createPaymentMutation]);

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
        title="Pay on Account"
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
              Payment on Account
            </h1>
            <p className="text-slate-500 mt-2">
              Record a payment not tied to an invoice
            </p>
          </div>

          {successMessage ? (
            <div className="max-w-[960px] mx-auto mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 text-center font-medium">
              {successMessage}
            </div>
          ) : null}

          <div className="max-w-[960px] mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <UpfrontPaymentForm
              form={upfrontForm}
              tenants={allTenants}
              tenantsLoading={upfTenantLookupQuery.isLoading}
              onSubmit={onSubmitUpfrontPayment}
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
