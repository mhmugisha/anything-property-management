"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import TenantsSidebar from "@/components/Shell/TenantsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { Search, X } from "lucide-react";
import {
  useTenants,
  buildTenantsQueryKey,
  fetchTenants,
  useTenantDetail,
  useCreateTenant,
  useUpdateTenant,
  useTenantLeases,
  useVacantUnits,
  useCreateLease,
  useCreateTenantWithLease,
  useUpdateLease,
  useArchiveTenant,
  useReactivateTenant,
  useEndTenantLease,
  useDeleteTenant,
  useOpenTenantLease,
} from "@/hooks/useTenants";
import { TenantDetails } from "@/components/Tenants/TenantDetails";
import { TenantReadOnlyView } from "@/components/Tenants/TenantReadOnlyView";
import { useLeaseOptions } from "@/hooks/useLeaseOptions";
import { useTenantFormHandlers } from "@/hooks/useTenantFormHandlers";
import { INITIAL_TENANT, INITIAL_LEASE } from "@/utils/tenantConstants";
import { fetchJson } from "@/utils/api";

const ALL_VALUE = "all";

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-gray-100 shadow-xl p-5">
        <div className="text-lg font-semibold text-slate-800">{title}</div>
        <div className="mt-2 text-sm text-slate-600">{message}</div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
          >
            {confirmLabel || "Yes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedLandlordId, setSelectedLandlordId] = useState(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState(null);

  const [showArchived, setShowArchived] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [deepLinkNewTenantHandled, setDeepLinkNewTenantHandled] =
    useState(false);

  const [tenantForm, setTenantForm] = useState(INITIAL_TENANT);
  const [leaseForm, setLeaseForm] = useState(INITIAL_LEASE);

  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Yes",
    action: null,
  });

  /* ========== GLOBAL SEARCH ========== */
  const [globalSearch, setGlobalSearch] = useState("");
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const globalSearchRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalSearch(globalSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  const globalSearchQuery = useQuery({
    queryKey: ["tenants", "global-search", debouncedGlobalSearch],
    queryFn: async () => {
      return fetchTenants({
        search: debouncedGlobalSearch,
        landlordId: null,
        propertyId: null,
        includeArchived: true,
      });
    },
    enabled: !!debouncedGlobalSearch && debouncedGlobalSearch.length >= 2,
    placeholderData: (prev) => prev,
  });

  const globalSearchResults =
    debouncedGlobalSearch.length >= 2 ? globalSearchQuery.data || [] : [];

  useEffect(() => {
    if (!globalSearchOpen) return;
    const handleClickOutside = (e) => {
      if (
        globalSearchRef.current &&
        !globalSearchRef.current.contains(e.target)
      ) {
        setGlobalSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [globalSearchOpen]);

  const onSelectGlobalTenant = useCallback((tenant) => {
    setSelectedTenantId(tenant.id);
    setIsCreating(false);
    setIsEditing(false);
    setActionError(null);
    setActionSuccess(false);
    setGlobalSearch("");
    setGlobalSearchOpen(false);
  }, []);

  const canManageTenants = staffQuery.data?.permissions?.tenants === true;

  const landlordIdFilter =
    selectedLandlordId && String(selectedLandlordId) !== ALL_VALUE
      ? selectedLandlordId
      : null;

  const propertyIdFilter =
    selectedPropertyId && String(selectedPropertyId) !== ALL_VALUE
      ? selectedPropertyId
      : null;

  const tenantsQuery = useTenants(
    "",
    { landlordId: landlordIdFilter, propertyId: propertyIdFilter },
    {
      enabled:
        !userLoading &&
        !!user &&
        canManageTenants &&
        !!selectedLandlordId &&
        !!selectedPropertyId,
      includeArchived: showArchived === true,
    },
  );

  const tenantDetailQuery = useTenantDetail(
    selectedTenantId,
    canManageTenants && !!selectedTenantId,
  );

  const leasesQuery = useTenantLeases(selectedTenantId, canManageTenants);
  const leases = leasesQuery.data || [];

  const activeLease = useMemo(() => {
    const active = leases.find((l) => l.status === "active");
    return active || null;
  }, [leases]);

  const latestLease = useMemo(() => {
    return leases?.[0] || null;
  }, [leases]);

  const canOpenLease =
    !activeLease && !!latestLease && latestLease.status === "ended";

  const includeUnitId = activeLease?.unit_id || null;

  const vacantUnitsQuery = useVacantUnits(
    { includeUnitId },
    canManageTenants && (isCreating || !!selectedTenantId),
  );

  const createTenantMutation = useCreateTenant();
  const updateTenantMutation = useUpdateTenant();
  const createLeaseMutation = useCreateLease();
  const createTenantWithLeaseMutation = useCreateTenantWithLease();
  const updateLeaseMutation = useUpdateLease();

  const archiveTenantMutation = useArchiveTenant();
  const reactivateTenantMutation = useReactivateTenant();
  const endLeaseMutation = useEndTenantLease();
  const openLeaseMutation = useOpenTenantLease();
  const deleteTenantMutation = useDeleteTenant();

  const tenants = tenantsQuery.data || [];
  const selectedTenant = tenantDetailQuery.data || null;
  const vacantUnits = vacantUnitsQuery.data || [];

  const isLoading = userLoading || staffQuery.isLoading;

  /* ========== LOOKUPS ========== */
  const landlordLookupQuery = useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson(`/api/lookups/landlords`);
      return data.landlords || [];
    },
    enabled: !userLoading && !!user && !!staffQuery.data,
  });

  const landlords = landlordLookupQuery.data || [];

  const landlordOptions = useMemo(() => {
    const list = landlords.map((l) => {
      const label = `${l.title ? `${l.title} ` : ""}${l.full_name}`;
      return { id: l.id, label };
    });
    list.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return [{ id: ALL_VALUE, label: "All landlords" }, ...list];
  }, [landlords]);

  const landlordOptionsForForm = useMemo(() => {
    return landlordOptions.filter((o) => String(o.id) !== ALL_VALUE);
  }, [landlordOptions]);

  const landlordPropertiesQuery = useQuery({
    queryKey: ["tenants", "properties", selectedLandlordId],
    queryFn: async () => {
      if (!selectedLandlordId) return [];
      if (String(selectedLandlordId) === ALL_VALUE) {
        const data = await fetchJson(`/api/tenants/properties`);
        return data.properties || [];
      }
      const data = await fetchJson(
        `/api/tenants/landlord-properties/${selectedLandlordId}`,
      );
      return data.properties || [];
    },
    enabled: !userLoading && !!user && canManageTenants && !!selectedLandlordId,
  });

  const propertiesForLandlord = landlordPropertiesQuery.data || [];

  const propertiesSorted = useMemo(() => {
    const list = [...propertiesForLandlord];
    list.sort((a, b) =>
      String(a.property_name || "").localeCompare(
        String(b.property_name || ""),
      ),
    );
    return list;
  }, [propertiesForLandlord]);

  /* Build property options for sidebar: "All properties" + sorted list */
  const sidebarPropertyOptions = useMemo(() => {
    const allOption = {
      id: ALL_VALUE,
      property_name: "All properties",
      address: "",
    };
    return [allOption, ...propertiesSorted];
  }, [propertiesSorted]);

  const isAllLandlordsSelected =
    !!selectedLandlordId && String(selectedLandlordId) === ALL_VALUE;

  const defaultLandlordIdForNewLease =
    selectedLandlordId && String(selectedLandlordId) !== ALL_VALUE
      ? selectedLandlordId
      : null;

  const defaultPropertyIdForNewLease =
    selectedPropertyId && String(selectedPropertyId) !== ALL_VALUE
      ? selectedPropertyId
      : null;

  // Fetch all properties for the landlord selected in the lease form
  const leaseFormLandlordId = leaseForm.landlord_id
    ? Number(leaseForm.landlord_id)
    : null;
  const landlordPropertiesForFormQuery = useQuery({
    queryKey: ["landlords", leaseFormLandlordId, "properties-for-form"],
    queryFn: async () => {
      const data = await fetchJson(
        `/api/landlords/${leaseFormLandlordId}/properties`,
      );
      return data.properties || [];
    },
    enabled: !!leaseFormLandlordId && (isCreating || isEditing),
  });

  const landlordPropertiesForForm = landlordPropertiesForFormQuery.data || [];

  const { propertyOptions, unitOptions } = useLeaseOptions(
    vacantUnits,
    leaseForm.landlord_id,
    leaseForm.property_id,
    landlordPropertiesForForm,
  );

  const saveWarning =
    createTenantWithLeaseMutation.data?.warning ||
    (createTenantWithLeaseMutation.data?.invoiceInsertedCount === 0
      ? "Invoices were not generated for this lease yet."
      : null);

  const {
    onStartCreate,
    onStartEdit,
    onSaveTenant,
    onLandlordChange,
    onPropertyChange,
    onUnitChange,
    onCancel,
  } = useTenantFormHandlers({
    selectedTenant,
    leases,
    setIsCreating,
    setIsEditing,
    setSelectedTenantId,
    setTenantForm,
    setLeaseForm,
    createTenantWithLeaseMutation,
    updateTenantMutation,
    updateLeaseMutation,
    createLeaseMutation,
    tenantForm,
    leaseForm,
    isCreating,
    isEditing,
    selectedTenantId,
    unitOptions,
    defaultLandlordId: defaultLandlordIdForNewLease,
    defaultPropertyId: defaultPropertyIdForNewLease,
  });

  useEffect(() => {
    if (deepLinkNewTenantHandled) return;
    if (typeof window === "undefined") return;
    if (userLoading) return;
    if (!user) return;
    if (!canManageTenants) return;

    const sp = new URLSearchParams(window.location.search);
    const shouldOpen = (sp.get("new") || "").trim() === "1";
    if (shouldOpen) {
      onStartCreate();
      setDeepLinkNewTenantHandled(true);
    }
  }, [
    deepLinkNewTenantHandled,
    userLoading,
    user,
    canManageTenants,
    onStartCreate,
  ]);

  const onSelectTenant = useCallback(
    (t) => {
      setSelectedTenantId(t.id);
      setIsCreating(false);
      setIsEditing(false);
      setActionError(null);
      setActionSuccess(false);
    },
    [setSelectedTenantId],
  );

  const prefetchTenantsForProperty = useCallback(
    (propertyIdToPrefetch) => {
      if (!selectedLandlordId) return;

      const landlordKey = selectedLandlordId;
      const propertyKey = propertyIdToPrefetch;

      if (!landlordKey || !propertyKey) return;

      const landlordIdForPrefetch =
        String(landlordKey) === ALL_VALUE ? null : landlordKey;

      const propertyIdForPrefetch =
        String(propertyKey) === ALL_VALUE ? null : propertyKey;

      const key = buildTenantsQueryKey({
        search: "",
        landlordId: landlordIdForPrefetch,
        propertyId: propertyIdForPrefetch,
        includeArchived: showArchived === true,
      });

      queryClient.prefetchQuery({
        queryKey: key,
        queryFn: async () =>
          fetchTenants({
            search: "",
            landlordId: landlordIdForPrefetch,
            propertyId: propertyIdForPrefetch,
            includeArchived: showArchived === true,
          }),
      });
    },
    [queryClient, selectedLandlordId, showArchived],
  );

  const onSelectLandlord = useCallback((landlordId) => {
    setSelectedLandlordId(landlordId);
    setSelectedPropertyId(null);
    setSelectedTenantId(null);
    setIsCreating(false);
    setIsEditing(false);
    setSearch("");
    setTenantForm(INITIAL_TENANT);
    setLeaseForm(INITIAL_LEASE);
    setShowArchived(false);
    setActionError(null);
    setActionSuccess(false);
  }, []);

  const onSelectProperty = useCallback((propertyId) => {
    setSelectedPropertyId(propertyId);
    setSelectedTenantId(null);
    setIsCreating(false);
    setIsEditing(false);
    setSearch("");
    setShowArchived(false);
    setActionError(null);
    setActionSuccess(false);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({
      open: false,
      title: "",
      message: "",
      confirmLabel: "Yes",
      action: null,
    });
  }, []);

  const openConfirm = useCallback(
    ({ title, message, confirmLabel, action }) => {
      setConfirmState({
        open: true,
        title,
        message,
        confirmLabel: confirmLabel || "Yes",
        action,
      });
    },
    [],
  );

  const runAction = useCallback(async () => {
    if (!confirmState.action) return;
    setActionError(null);
    setActionSuccess(false);
    confirmState.action();
  }, [confirmState.action]);

  const markSuccess = useCallback(() => {
    setActionSuccess(true);
    window.setTimeout(() => setActionSuccess(false), 2500);
  }, []);

  const onArchiveTenant = useCallback(() => {
    if (!selectedTenantId) return;
    openConfirm({
      title: "Are you sure?",
      message:
        "Archive this tenant? This will end the active lease (if any) and make the unit vacant. You can activate later.",
      confirmLabel: "Yes",
      action: () => {
        archiveTenantMutation.mutate(selectedTenantId, {
          onSuccess: () => {
            setShowArchived(true);
            closeConfirm();
            markSuccess();
          },
          onError: (e) => {
            console.error(e);
            closeConfirm();
            setActionError("Could not archive tenant.");
          },
        });
      },
    });
  }, [
    selectedTenantId,
    archiveTenantMutation,
    openConfirm,
    closeConfirm,
    markSuccess,
  ]);

  const onActivateTenant = useCallback(() => {
    if (!selectedTenantId) return;
    openConfirm({
      title: "Are you sure?",
      message:
        "Activate this tenant? Billing will resume from the first day of next month.",
      confirmLabel: "Yes",
      action: () => {
        reactivateTenantMutation.mutate(selectedTenantId, {
          onSuccess: () => {
            closeConfirm();
            markSuccess();
          },
          onError: (e) => {
            console.error(e);
            closeConfirm();
            setActionError("Could not activate tenant.");
          },
        });
      },
    });
  }, [
    selectedTenantId,
    reactivateTenantMutation,
    openConfirm,
    closeConfirm,
    markSuccess,
  ]);

  const onEndLease = useCallback(() => {
    if (!selectedTenantId) return;
    openConfirm({
      title: "Are you sure?",
      message:
        "End the active lease for this tenant? This will make the unit vacant and stop billing from next month.",
      confirmLabel: "Yes",
      action: () => {
        endLeaseMutation.mutate(selectedTenantId, {
          onSuccess: () => {
            setShowArchived(true);
            closeConfirm();
            markSuccess();
          },
          onError: (e) => {
            console.error(e);
            closeConfirm();
            setActionError("Could not end lease.");
          },
        });
      },
    });
  }, [
    selectedTenantId,
    endLeaseMutation,
    openConfirm,
    closeConfirm,
    markSuccess,
  ]);

  const onOpenLease = useCallback(() => {
    if (!selectedTenantId) return;
    openConfirm({
      title: "Are you sure?",
      message:
        "Open a new lease for this tenant starting from the first day of next month?",
      confirmLabel: "Yes",
      action: () => {
        openLeaseMutation.mutate(selectedTenantId, {
          onSuccess: () => {
            closeConfirm();
            markSuccess();
          },
          onError: (e) => {
            console.error(e);
            closeConfirm();
            setActionError(
              "Could not open lease. The previous unit may not be available anymore.",
            );
          },
        });
      },
    });
  }, [
    selectedTenantId,
    openLeaseMutation,
    openConfirm,
    closeConfirm,
    markSuccess,
  ]);

  const onDeleteTenant = useCallback(() => {
    if (!selectedTenantId) return;
    openConfirm({
      title: "Are you sure?",
      message:
        "Delete this tenant and all tenant data (leases, invoices, payments, etc.)? This cannot be undone.",
      confirmLabel: "Yes",
      action: () => {
        deleteTenantMutation.mutate(selectedTenantId, {
          onSuccess: () => {
            setSelectedTenantId(null);
            setIsCreating(false);
            setIsEditing(false);
            closeConfirm();
            markSuccess();
          },
          onError: (e) => {
            console.error(e);
            closeConfirm();
            setActionError("Could not delete tenant.");
          },
        });
      },
    });
  }, [
    selectedTenantId,
    deleteTenantMutation,
    openConfirm,
    closeConfirm,
    markSuccess,
  ]);

  /* ========== RENDER ========== */

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

  if (!canManageTenants) {
    return (
      <AccessDenied
        title="Tenants"
        message="You don't have access to manage tenants."
      />
    );
  }

  const tenantError =
    createTenantMutation.error ||
    updateTenantMutation.error ||
    createTenantWithLeaseMutation.error ||
    updateLeaseMutation.error;

  const isSavingTenant =
    createTenantMutation.isPending ||
    updateTenantMutation.isPending ||
    createTenantWithLeaseMutation.isPending ||
    updateLeaseMutation.isPending;

  const canSaveTenantWhenCreating =
    !!tenantForm.full_name &&
    !!tenantForm.phone &&
    !!leaseForm.landlord_id &&
    !!leaseForm.property_id &&
    !!leaseForm.unit_id &&
    !!leaseForm.start_date &&
    !!leaseForm.monthly_rent;

  const canSaveTenantWhenEditing =
    !!tenantForm.full_name &&
    !!tenantForm.phone &&
    !!leaseForm.landlord_id &&
    !!leaseForm.property_id &&
    !!leaseForm.unit_id &&
    !!leaseForm.start_date &&
    !!leaseForm.monthly_rent;

  const isReadOnly = !isCreating && !isEditing && !!selectedTenant;
  const isArchivedTenant = selectedTenant?.status === "archived";
  const canEndLease = !!activeLease && activeLease.status === "active";

  const detailTitle = isCreating
    ? "New Tenant"
    : isEditing
      ? "Edit tenant"
      : selectedTenant
        ? selectedTenant.full_name
        : "Select a tenant";

  const endedSuffix =
    !canEndLease && latestLease?.status === "ended" ? " • Ended" : "";
  const archivedSuffix = isArchivedTenant ? " • Archived" : "";

  const detailSubtitle = isReadOnly
    ? `${selectedTenant?.phone || ""}${archivedSuffix}${endedSuffix}`
    : "Manage tenant profile and leases";

  const isConfirmLoading =
    archiveTenantMutation.isPending ||
    reactivateTenantMutation.isPending ||
    endLeaseMutation.isPending ||
    openLeaseMutation.isPending ||
    deleteTenantMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Tenants"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="tenants"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="tenants"
      />
      <Sidebar active="tenants">
        <TenantsSidebar
          landlordOptions={landlordOptions}
          selectedLandlordId={selectedLandlordId}
          onSelectLandlord={onSelectLandlord}
          landlordsLoading={landlordLookupQuery.isLoading}
          properties={sidebarPropertyOptions}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={onSelectProperty}
          propertiesLoading={landlordPropertiesQuery.isLoading}
          isAllLandlordsSelected={isAllLandlordsSelected}
          tenants={tenants}
          search={search}
          onSearchChange={setSearch}
          selectedTenantId={selectedTenantId}
          onSelectTenant={onSelectTenant}
          onStartCreate={onStartCreate}
          tenantsLoading={tenantsQuery.isLoading}
          showArchived={showArchived}
          onToggleShowArchived={setShowArchived}
          onPrefetchProperty={prefetchTenantsForProperty}
        />
      </Sidebar>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={runAction}
        onCancel={closeConfirm}
        loading={isConfirmLoading}
      />

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          {/* Global Search */}
          <div className="mb-4 relative" ref={globalSearchRef}>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-100">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setGlobalSearchOpen(true);
                }}
                onFocus={() => {
                  if (globalSearch.trim().length >= 2)
                    setGlobalSearchOpen(true);
                }}
                placeholder="Search all tenants by name, phone or email…"
                className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400"
              />
              {globalSearch ? (
                <button
                  onClick={() => {
                    setGlobalSearch("");
                    setGlobalSearchOpen(false);
                  }}
                >
                  <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                </button>
              ) : null}
            </div>

            {globalSearchOpen && debouncedGlobalSearch.length >= 2 ? (
              <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-lg border border-gray-100 max-h-[360px] overflow-auto">
                {globalSearchQuery.isLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    Searching…
                  </div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    No tenants found
                  </div>
                ) : (
                  globalSearchResults.map((t) => {
                    const statusText = (t.status || "active").toLowerCase();
                    const leaseText = (t.lease_status || "").toLowerCase();
                    const badge =
                      statusText === "archived"
                        ? "archived"
                        : leaseText === "ended"
                          ? "ended"
                          : "active";
                    const badgeColor =
                      badge === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700";

                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelectGlobalTenant(t)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-gray-50 last:border-b-0 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {t.title ? `${t.title} ` : ""}
                            {t.full_name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {t.phone}
                            {t.email ? ` • ${t.email}` : ""}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}
                        >
                          {badge}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <TenantDetails
              isCreating={isCreating}
              isEditing={isEditing}
              tenantForm={tenantForm}
              leaseForm={leaseForm}
              onTenantFormChange={setTenantForm}
              onLeaseFormChange={setLeaseForm}
              onLandlordChange={onLandlordChange}
              onPropertyChange={onPropertyChange}
              onUnitChange={onUnitChange}
              landlordOptions={landlordOptionsForForm}
              propertyOptions={propertyOptions}
              unitOptions={unitOptions}
              onSave={onSaveTenant}
              onCancel={onCancel}
              isSaving={isSavingTenant}
              error={tenantError}
              canSave={
                isCreating
                  ? canSaveTenantWhenCreating
                  : isEditing
                    ? canSaveTenantWhenEditing
                    : true
              }
              detailTitle={detailTitle}
              detailSubtitle={detailSubtitle}
              onStartEdit={onStartEdit}
              showEditButton={!isCreating && !isEditing && selectedTenant}
              selectedTenantId={selectedTenantId}
              isArchived={isArchivedTenant}
              canEndLease={canEndLease}
              canOpenLease={canOpenLease}
              onArchive={onArchiveTenant}
              onReactivate={onActivateTenant}
              onEndLease={onEndLease}
              onOpenLease={onOpenLease}
              onDelete={onDeleteTenant}
              isArchiving={archiveTenantMutation.isPending}
              isReactivating={reactivateTenantMutation.isPending}
              isEndingLease={endLeaseMutation.isPending}
              isOpeningLease={openLeaseMutation.isPending}
              isDeleting={deleteTenantMutation.isPending}
              actionError={actionError}
              actionSuccess={actionSuccess}
              saveWarning={saveWarning}
            />

            {!isCreating && !isEditing && selectedTenant ? (
              <TenantReadOnlyView selectedTenant={selectedTenant} />
            ) : null}

            {!isCreating && !isEditing && !selectedTenant ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm border border-dashed border-gray-200 text-center text-slate-500">
                {selectedPropertyId
                  ? "Select a tenant from the sidebar, or create a new one."
                  : "Select a landlord and property from the sidebar to view tenants."}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
