"use client";

import { useCallback, useState, useMemo, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useCreateArrears } from "@/hooks/useAccounting";
import { useAccountingLookups } from "@/hooks/useAccountingLookups";
import { PostArrearsForm } from "@/components/Accounting/PostArrearsForm";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function PostArrearsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const lookups = useAccountingLookups(
    !userLoading && !!user && canUseAccounting,
    {
      tenantPropertyId: propertyId,
    },
  );

  const createArrearsMutation = useCreateArrears();

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
    if (createArrearsMutation.error) {
      const timer = setTimeout(() => {
        createArrearsMutation.reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [createArrearsMutation.error, createArrearsMutation]);

  const onPropertyChange = useCallback((next) => {
    setPropertyId(next);
    setTenantId("");
  }, []);

  const onSubmit = useCallback(() => {
    // Clear any previous messages
    setSuccessMessage(null);
    createArrearsMutation.reset();

    const payload = {
      tenant_id: tenantId ? Number(tenantId) : null,
      arrears_date: date,
      description,
      amount: amount === "" ? null : Number(amount),
    };

    createArrearsMutation.mutate(payload, {
      onSuccess: () => {
        setDescription("");
        setAmount("");
        setSuccessMessage("Arrears invoice created successfully!");
      },
    });
  }, [tenantId, date, description, amount, createArrearsMutation]);

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
        title="Post Arrears"
        message="You don't have access to the accounting module."
      />
    );
  }

  const properties = lookups.properties || [];
  const tenants = lookups.tenants || [];

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Post Arrears"
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
              Post Arrears
            </h1>
            <p className="text-slate-500 mt-2">
              Create arrears invoices for tenants (treated as rent for
              accounting)
            </p>
          </div>

          <div className="max-w-[960px] mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <PostArrearsForm
              propertyId={propertyId}
              tenantId={tenantId}
              date={date}
              description={description}
              amount={amount}
              properties={properties}
              tenants={tenants}
              onPropertyChange={onPropertyChange}
              onTenantChange={setTenantId}
              onDateChange={setDate}
              onDescriptionChange={setDescription}
              onAmountChange={setAmount}
              onSubmit={onSubmit}
              isPending={createArrearsMutation.isPending}
            />
          </div>

          {successMessage ? (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {createArrearsMutation.error ? (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {createArrearsMutation.error?.message ||
                "Could not create arrears invoice."}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
