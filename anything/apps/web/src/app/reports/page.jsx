"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import ReportsSidebar from "@/components/Shell/ReportsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useArrearsReport } from "@/hooks/useReports";
import { useReportsLookups } from "@/hooks/useReportsLookups";
import { ArrearsReport } from "@/components/Reports/ArrearsReport";
import { TenantStatementReport } from "@/components/Reports/TenantStatementReport";
import { LandlordMonthlySummary } from "@/components/Reports/LandlordMonthlySummary";
import { LandlordStatementReport } from "@/components/Reports/LandlordStatementReport";
import { PropertyStatementReport } from "@/components/Reports/PropertyStatementReport";
import { LandlordPayoutsSummary } from "@/components/Reports/LandlordPayoutsSummary";
import { PaymentStatusReport } from "@/components/Reports/PaymentStatusReport";
import { ConsolidatedBalancesDueReport } from "@/components/Reports/ConsolidatedBalancesDueReport";
import { AllTenantsReport } from "@/components/Reports/AllTenantsReport";

export default function ReportsPage() {
  const [reportType, setReportType] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setReportType(params.get("report") || "");
  }, []);

  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canViewReports = staffQuery.data?.permissions?.reports === true;
  const canManagePayments = staffQuery.data?.permissions?.payments === true;

  const arrearsQuery = useArrearsReport(
    !userLoading && !!user && canViewReports,
  );

  const { landlordLookupQuery, propertyLookupQuery } = useReportsLookups(
    !userLoading && !!user && canViewReports,
  );

  const landlordsLookup = landlordLookupQuery.data || [];
  const propertiesLookup = propertyLookupQuery.data || [];

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
        title="Reports"
        message="You don't have access to reports."
      />
    );
  }

  const renderReport = () => {
    switch (reportType) {
      case "arrears":
        return <ArrearsReport arrearsQuery={arrearsQuery} />;
      case "tenant-statement":
        return (
          <TenantStatementReport
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
            canManagePayments={canManagePayments}
          />
        );
      case "payment-status":
        return (
          <PaymentStatusReport
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      case "landlord-summary":
        return (
          <LandlordMonthlySummary
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      case "landlord-payouts":
        return (
          <LandlordPayoutsSummary
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      case "landlord-statement":
        return (
          <LandlordStatementReport
            landlordsLookup={landlordsLookup}
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      case "property-statement":
        return (
          <PropertyStatementReport
            propertiesLookup={propertiesLookup}
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      case "consolidated-balances-due":
        return (
          <ConsolidatedBalancesDueReport
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      case "all-tenants":
        return (
          <AllTenantsReport
            userLoading={userLoading}
            user={user}
            canViewReports={canViewReports}
          />
        );
      default:
        return (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">
              Select a report from the sidebar to get started
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Reports"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="reports"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="reports"
      />
      <Sidebar active="reports">
        <ReportsSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6">{renderReport()}</div>
      </main>
    </div>
  );
}
