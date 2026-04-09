"use client";

import { useState } from "react";
import { LandlordPayableBalancesReport } from "@/components/Reports/LandlordPayableBalancesReport";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import DashboardSidebar from "@/components/Shell/DashboardSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";

export default function DueToLandlordsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canViewReports = staffQuery.data?.permissions?.reports === true;

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

  if (!canViewReports) {
    return (
      <AccessDenied
        title="Due to Landlords"
        message="You don't have access to reports."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Due to Landlords"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="reports"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="reports"
      />
      <Sidebar active="reports">
        <DashboardSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6">
          <LandlordPayableBalancesReport
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        </div>
      </main>
    </div>
  );
}
