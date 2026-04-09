"use client";

import { useCallback, useState, useMemo, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useCreateLandlordDeduction } from "@/hooks/useAccounting";
import { useAccountingLookups } from "@/hooks/useAccountingLookups";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";
import { LandlordDeductionForm } from "@/components/Accounting/LandlordDeductionForm";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function LandlordExpenseDeductionPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [landlordId, setLandlordId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const lookups = useAccountingLookups(
    !userLoading && !!user && canUseAccounting,
  );

  const accountRegistry = useAccountRegistry(
    !userLoading && !!user && canUseAccounting,
  );

  const paymentAccounts = useMemo(() => {
    const accounts = accountRegistry.accounts || [];
    return accounts.filter(
      (a) =>
        a.is_active !== false &&
        (a.account_code === "1110" || a.account_code === "1120"),
    );
  }, [accountRegistry.accounts]);

  const createLandlordDeductionMutation = useCreateLandlordDeduction();

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
    if (createLandlordDeductionMutation.error) {
      const timer = setTimeout(() => {
        createLandlordDeductionMutation.reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [createLandlordDeductionMutation.error, createLandlordDeductionMutation]);

  const onLandlordChange = useCallback((next) => {
    setLandlordId(next);
    setPropertyId("");
  }, []);

  const onSubmit = useCallback(() => {
    // Clear any previous messages
    setSuccessMessage(null);
    createLandlordDeductionMutation.reset();

    const payload = {
      landlord_id: landlordId ? Number(landlordId) : null,
      property_id: propertyId ? Number(propertyId) : null,
      deduction_date: date,
      description,
      amount: amount === "" ? null : Number(amount),
      payment_account_id: paymentAccountId ? Number(paymentAccountId) : null,
    };

    createLandlordDeductionMutation.mutate(payload, {
      onSuccess: () => {
        setDescription("");
        setAmount("");
        setSuccessMessage("Landlord deduction saved successfully!");
      },
    });
  }, [
    landlordId,
    propertyId,
    date,
    description,
    amount,
    paymentAccountId,
    createLandlordDeductionMutation,
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
        title="Landlord Deduction"
        message="You don't have access to the accounting module."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Landlord Deduction"
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
              Landlord Deduction
            </h1>
            <p className="text-slate-500 mt-2">
              Record expense deductions for landlords
            </p>
          </div>

          <LandlordDeductionForm
            landlordId={landlordId}
            propertyId={propertyId}
            date={date}
            description={description}
            amount={amount}
            paymentAccountId={paymentAccountId}
            landlords={lookups.landlords || []}
            properties={lookups.properties || []}
            paymentAccounts={paymentAccounts}
            onLandlordChange={onLandlordChange}
            onPropertyChange={setPropertyId}
            onDateChange={setDate}
            onDescriptionChange={setDescription}
            onAmountChange={setAmount}
            onPaymentAccountChange={setPaymentAccountId}
            onSubmit={onSubmit}
            isPending={createLandlordDeductionMutation.isPending}
          />

          {successMessage ? (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {createLandlordDeductionMutation.error ? (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {createLandlordDeductionMutation.error?.message ||
                "Could not save landlord deduction."}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
