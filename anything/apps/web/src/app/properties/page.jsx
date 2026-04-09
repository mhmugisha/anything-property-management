"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import {
  useProperties,
  usePropertyDetail,
  useCreateProperty,
  useUpdateProperty,
} from "@/hooks/useProperties";
import {
  useUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
} from "@/hooks/useUnits";
import AppHeader from "@/components/Shell/AppHeader";
import MobileMenu from "@/components/Shell/MobileMenu";
import Sidebar from "@/components/Shell/Sidebar";
import PropertiesSidebar from "@/components/Shell/PropertiesSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { PropertyDetails } from "@/components/Properties/PropertyDetails";
import { UnitFormModal } from "@/components/Properties/UnitFormModal";
import { fetchJson } from "@/utils/api";

const INITIAL_PROPERTY_FORM = {
  landlord_id: "",
  property_name: "",
  address: "",
  property_type: "",
  management_fee_type: "percent",
  management_fee_percent: "10",
  management_fee_fixed_amount: "",
  notes: "",
};

const INITIAL_UNIT_FORM = {
  unit_number: "",
  bedrooms: "",
  bathrooms: "",
  square_feet: "",
  monthly_rent_ugx: "",
  status: "vacant",
  photos: [],
};

export default function PropertiesPage() {
  const { data: user, loading: userLoading } = useUser();
  const [upload, uploadState] = useUpload();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);

  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [editingProperty, setEditingProperty] = useState(false);

  const [propertyForm, setPropertyForm] = useState(INITIAL_PROPERTY_FORM);

  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [unitEditingId, setUnitEditingId] = useState(null);
  const [unitForm, setUnitForm] = useState(INITIAL_UNIT_FORM);
  const [unitFormError, setUnitFormError] = useState(null);

  const [deepLinkNewUnitHandled, setDeepLinkNewUnitHandled] = useState(false);

  const staffQuery = useStaffProfile(!userLoading && !!user);

  const canManageProperties =
    staffQuery.data?.permissions?.properties === true || false;

  // Fetch ALL properties (sidebar filters client-side)
  const propertiesQuery = useProperties(
    "",
    !userLoading && !!user && canManageProperties,
  );

  const properties = propertiesQuery.data || [];

  const selectedProperty = useMemo(() => {
    const pid = selectedPropertyId;
    if (!pid) return null;
    const found = properties.find((p) => p.id === pid);
    return found || null;
  }, [properties, selectedPropertyId]);

  const propertyDetailQuery = usePropertyDetail(
    selectedPropertyId,
    canManageProperties,
  );

  const unitsQuery = useUnits(selectedPropertyId, canManageProperties);

  const createPropertyMutation = useCreateProperty();
  const updatePropertyMutation = useUpdateProperty();
  const createUnitMutation = useCreateUnit(selectedPropertyId);
  const updateUnitMutation = useUpdateUnit(selectedPropertyId);
  const deleteUnitMutation = useDeleteUnit(selectedPropertyId);

  const landlordLookupQuery = useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/landlords");
      return data.landlords || [];
    },
    enabled: !userLoading && !!user && !!staffQuery.data,
  });

  const landlordOptions = useMemo(() => {
    const list = landlordLookupQuery.data || [];
    return list.map((l) => {
      const label = `${l.title ? `${l.title} ` : ""}${l.full_name}`;
      return { id: l.id, label };
    });
  }, [landlordLookupQuery.data]);

  const onOpenCreateProperty = useCallback(() => {
    setShowCreateProperty(true);
    setEditingProperty(false);
    setPropertyForm(INITIAL_PROPERTY_FORM);
    setSelectedPropertyId(null);
  }, []);

  const onCancelPropertyEditOrCreate = useCallback(() => {
    setShowCreateProperty(false);
    setEditingProperty(false);
    setPropertyForm(INITIAL_PROPERTY_FORM);
  }, []);

  const onOpenEditProperty = useCallback(() => {
    const p = propertyDetailQuery.data;
    if (!p) return;

    setEditingProperty(true);
    setShowCreateProperty(false);

    const type = p.management_fee_type || "percent";

    const feePercentRaw =
      p.management_fee_percent !== null &&
      p.management_fee_percent !== undefined
        ? String(p.management_fee_percent)
        : "";

    const feePercentNum =
      feePercentRaw.trim() === "" ? Number.NaN : Number(feePercentRaw);

    const nextFeePercent = Number.isFinite(feePercentNum)
      ? feePercentRaw
      : "10";

    setPropertyForm({
      landlord_id: p.landlord_id ? String(p.landlord_id) : "",
      property_name: p.property_name || "",
      address: p.address || "",
      property_type: p.property_type || "",
      management_fee_type: type,
      management_fee_percent: type === "percent" ? nextFeePercent : "10",
      management_fee_fixed_amount:
        type === "fixed" &&
        p.management_fee_fixed_amount !== null &&
        p.management_fee_fixed_amount !== undefined
          ? String(p.management_fee_fixed_amount)
          : "",
      notes: p.notes || "",
    });
  }, [propertyDetailQuery.data]);

  const onSaveProperty = useCallback(async () => {
    const landlordIdNum = propertyForm.landlord_id
      ? Number(propertyForm.landlord_id)
      : null;

    const feeType = propertyForm.management_fee_type || "percent";

    const feePercentNum =
      propertyForm.management_fee_percent === "" ||
      propertyForm.management_fee_percent === null ||
      propertyForm.management_fee_percent === undefined
        ? null
        : Number(propertyForm.management_fee_percent);

    const feeFixedNum =
      propertyForm.management_fee_fixed_amount === "" ||
      propertyForm.management_fee_fixed_amount === null ||
      propertyForm.management_fee_fixed_amount === undefined
        ? null
        : Number(propertyForm.management_fee_fixed_amount);

    const payload = {
      landlord_id:
        landlordIdNum && Number.isFinite(landlordIdNum) ? landlordIdNum : null,
      property_name: propertyForm.property_name,
      address: propertyForm.address,
      property_type: propertyForm.property_type || null,
      management_fee_type: feeType,
      management_fee_percent: feeType === "percent" ? feePercentNum : null,
      management_fee_fixed_amount: feeType === "fixed" ? feeFixedNum : null,
      notes: propertyForm.notes || null,
    };

    if (showCreateProperty) {
      createPropertyMutation.mutate(payload, {
        onSuccess: (data) => {
          const createdId = data?.property?.id || null;
          if (createdId) setSelectedPropertyId(createdId);
          setShowCreateProperty(false);
          setPropertyForm(INITIAL_PROPERTY_FORM);
        },
      });
      return;
    }

    if (editingProperty && selectedPropertyId) {
      updatePropertyMutation.mutate(
        { id: selectedPropertyId, payload },
        {
          onSuccess: () => {
            setEditingProperty(false);
          },
        },
      );
    }
  }, [
    propertyForm,
    showCreateProperty,
    editingProperty,
    selectedPropertyId,
    createPropertyMutation,
    updatePropertyMutation,
  ]);

  const onOpenCreateUnit = useCallback(() => {
    setUnitFormOpen(true);
    setUnitEditingId(null);
    setUnitForm(INITIAL_UNIT_FORM);
  }, []);

  useEffect(() => {
    if (deepLinkNewUnitHandled) return;
    if (typeof window === "undefined") return;
    if (userLoading) return;
    if (!user) return;
    if (!canManageProperties) return;
    if (!selectedPropertyId) return;

    const sp = new URLSearchParams(window.location.search);
    const shouldOpen = (sp.get("newUnit") || "").trim() === "1";
    if (shouldOpen) {
      onOpenCreateUnit();
      setDeepLinkNewUnitHandled(true);
    }
  }, [
    deepLinkNewUnitHandled,
    userLoading,
    user,
    canManageProperties,
    selectedPropertyId,
    onOpenCreateUnit,
  ]);

  const onOpenEditUnit = useCallback((unit) => {
    setUnitFormOpen(true);
    setUnitEditingId(unit.id);
    setUnitFormError(null);
    setUnitForm({
      unit_number: unit.unit_number || "",
      bedrooms: unit.bedrooms ?? "",
      bathrooms: unit.bathrooms ?? "",
      square_feet: unit.square_feet ?? "",
      monthly_rent_ugx: unit.monthly_rent_ugx ?? "",
      status: unit.status || "vacant",
      photos: Array.isArray(unit.photos) ? unit.photos : [],
    });
  }, []);

  const onDeleteUnit = useCallback(
    (unit) => {
      if (
        !window.confirm(
          `Delete unit ${unit.unit_number}? This cannot be undone.`,
        )
      ) {
        return;
      }

      deleteUnitMutation.mutate(unit.id, {
        onSuccess: () => {
          // Success notification could be added here if you have a toast system
        },
        onError: (error) => {
          alert(error.message || "Failed to delete unit");
        },
      });
    },
    [deleteUnitMutation],
  );

  const onSaveUnit = useCallback(() => {
    if (!selectedPropertyId) return;

    const payload = {
      unit_number: unitForm.unit_number,
      bedrooms: unitForm.bedrooms === "" ? null : Number(unitForm.bedrooms),
      bathrooms: unitForm.bathrooms === "" ? null : Number(unitForm.bathrooms),
      square_feet:
        unitForm.square_feet === "" ? null : Number(unitForm.square_feet),
      monthly_rent_ugx:
        unitForm.monthly_rent_ugx === ""
          ? null
          : Number(unitForm.monthly_rent_ugx),
      status: unitForm.status,
      photos: unitForm.photos,
    };

    if (unitEditingId) {
      // When editing, close the modal after saving
      updateUnitMutation.mutate(
        { unitId: unitEditingId, payload },
        {
          onSuccess: () => {
            setUnitFormOpen(false);
            setUnitEditingId(null);
            setUnitForm(INITIAL_UNIT_FORM);
            setUnitFormError(null);
          },
          onError: (error) => {
            setUnitFormError(error);
          },
        },
      );
    } else {
      // When creating, keep the modal open and reset the form for another entry
      createUnitMutation.mutate(payload, {
        onSuccess: () => {
          setUnitForm(INITIAL_UNIT_FORM);
          setUnitFormError(null);
        },
        onError: (error) => {
          setUnitFormError(error);
        },
      });
    }
  }, [
    selectedPropertyId,
    unitForm,
    unitEditingId,
    createUnitMutation,
    updateUnitMutation,
  ]);

  const onClearUnitFormError = useCallback(() => {
    setUnitFormError(null);
  }, []);

  const onAddUnitPhotos = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      const nextPhotos = [...(unitForm.photos || [])];

      for (const file of files) {
        const result = await upload({ file });
        if (result?.error) {
          console.error(result.error);
          alert(result.error);
          continue;
        }
        if (result?.url) {
          nextPhotos.push(result.url);
        }
      }

      setUnitForm((prev) => ({ ...prev, photos: nextPhotos }));
    },
    [upload, unitForm.photos],
  );

  const handleSelectProperty = useCallback((id) => {
    setSelectedPropertyId(id);
    setShowCreateProperty(false);
    setEditingProperty(false);
  }, []);

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

  const units = unitsQuery.data || [];

  const propertyForDetails = propertyDetailQuery.data || selectedProperty;

  const selectedPropertyType = propertyForDetails
    ? propertyForDetails.property_type
    : null;

  const isSavingProperty =
    createPropertyMutation.isPending || updatePropertyMutation.isPending;

  const isSavingUnit =
    createUnitMutation.isPending || updateUnitMutation.isPending;

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
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={handleSelectProperty}
          onCreateProperty={onOpenCreateProperty}
        />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          {showCreateProperty || editingProperty || propertyForDetails ? (
            <PropertyDetails
              property={propertyForDetails}
              propertyForm={propertyForm}
              onPropertyFormChange={setPropertyForm}
              isEditingProperty={editingProperty}
              isCreatingProperty={showCreateProperty}
              onEditProperty={onOpenEditProperty}
              onCancelProperty={onCancelPropertyEditOrCreate}
              onSaveProperty={onSaveProperty}
              isSavingProperty={isSavingProperty}
              propertyError={
                createPropertyMutation.error || updatePropertyMutation.error
              }
              landlordOptions={landlordOptions}
              units={units}
              onCreateUnit={onOpenCreateUnit}
              onEditUnit={onOpenEditUnit}
              onDeleteUnit={onDeleteUnit}
              unitsLoading={unitsQuery.isLoading}
              unitsError={unitsQuery.error}
              properties={properties}
            />
          ) : (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-dashed border-gray-200 text-center text-slate-500">
              Select a property from the sidebar, or add a new one.
            </div>
          )}
        </div>

        <UnitFormModal
          isOpen={unitFormOpen}
          form={unitForm}
          onChange={setUnitForm}
          onSave={onSaveUnit}
          onClose={() => {
            setUnitFormOpen(false);
            setUnitEditingId(null);
            setUnitFormError(null);
          }}
          onAddPhotos={onAddUnitPhotos}
          isEditing={!!unitEditingId}
          isSaving={isSavingUnit}
          error={unitFormError}
          uploadLoading={uploadState.loading}
          propertyType={selectedPropertyType}
          onClearError={onClearUnitFormError}
        />
      </main>
    </div>
  );
}
