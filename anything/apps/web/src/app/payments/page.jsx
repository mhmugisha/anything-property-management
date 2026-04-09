"use client";

import { useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import PaymentsSidebar from "@/components/Shell/PaymentsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { usePayments } from "@/hooks/usePayments";
import { usePaymentFilters } from "@/hooks/usePaymentFilters";
import { PaymentsTable } from "@/components/Payments/PaymentsTable";

export default function PaymentsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canManagePayments = staffQuery.data?.permissions?.payments === true;

  const filters = usePaymentFilters();

  const paymentsQuery = usePayments(
    { search: filters.search, from: filters.from, to: filters.to },
    !userLoading && !!user && canManagePayments,
  );

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

  const payments = paymentsQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Payments"
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
        <div className="p-4 md:p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-slate-800">
              Payment History
            </h1>
            <p className="text-slate-500">View all recorded payments</p>
          </div>

          <PaymentsTable
            payments={payments}
            isLoading={paymentsQuery.isLoading}
            error={paymentsQuery.error}
            search={filters.search}
            setSearch={filters.setSearch}
            from={filters.from}
            setFrom={filters.setFrom}
            to={filters.to}
            setTo={filters.setTo}
          />
        </div>
      </main>
    </div>
  );
}
