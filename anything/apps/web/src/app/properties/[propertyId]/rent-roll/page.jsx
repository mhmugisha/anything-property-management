"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import { useProperties } from "@/hooks/useProperties";
import AppHeader from "@/components/Shell/AppHeader";
import MobileMenu from "@/components/Shell/MobileMenu";
import Sidebar from "@/components/Shell/Sidebar";
import PropertiesSidebar from "@/components/Shell/PropertiesSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { RentRollCard } from "@/components/Properties/RentRollCard";
import { fetchJson } from "@/utils/api";

export default function PropertyRentRollPage({ params }) {
  const propertyId = params.propertyId ? Number(params.propertyId) : null;
  const { data: user, loading: userLoading } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const staffQuery = useStaffProfile(!userLoading && !!user);

  const canManageProperties =
    staffQuery.data?.permissions?.properties === true || false;

  // Fetch the property to get its name
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const response = await fetchJson(`/api/properties/${propertyId}`);
      return response;
    },
    enabled: !!propertyId && canManageProperties,
  });

  // Fetch all properties for the sidebar
  const propertiesQuery = useProperties(
    "",
    !userLoading && !!user && canManageProperties,
  );

  const properties = propertiesQuery.data || [];

  const isLoadingScreen = userLoading || staffQuery.isLoading;

  if (isLoadingScreen) {
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

  if (!canManageProperties) {
    return (
      <AccessDenied
        title="Properties"
        message="You don't have access to manage properties."
      />
    );
  }

  if (!propertyId) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <div className="text-center text-slate-500">Invalid property ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Properties"
        onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        active="properties"
      />

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="properties"
      />

      <Sidebar active="properties">
        <PropertiesSidebar
          properties={properties}
          isLoading={propertiesQuery.isLoading}
          search={search}
          onSearchChange={setSearch}
          selectedPropertyId={propertyId}
          onSelectProperty={(id) => {
            window.location.href = `/properties`;
          }}
          onCreateProperty={() => {
            window.location.href = `/properties`;
          }}
        />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              {propertyLoading
                ? "Loading..."
                : `Rent Roll - ${property?.property_name || "Property"}`}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Generate and view the rent roll report for this property
            </p>
          </div>

          {/* Rent Roll Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <RentRollCard
              properties={properties}
              currentPropertyId={propertyId}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
