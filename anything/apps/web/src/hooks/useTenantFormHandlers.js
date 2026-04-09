import { useCallback } from "react";
import { INITIAL_TENANT, INITIAL_LEASE } from "@/utils/tenantConstants";

const OPEN_ENDED_END_DATE_CUTOFF = "2099-01-01";

function iso(d) {
  if (!d) return "";
  try {
    const s = String(d).slice(0, 10);
    // Treat far-future end dates as "open-ended" and show blank in the form.
    if (s >= OPEN_ENDED_END_DATE_CUTOFF) return "";
    return s;
  } catch {
    return "";
  }
}

export function useTenantFormHandlers({
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
  defaultLandlordId,
  defaultPropertyId,
}) {
  const onStartCreate = useCallback(() => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedTenantId(null);
    setTenantForm(INITIAL_TENANT);

    // If the user already selected a landlord in the UI, prefill it.
    setLeaseForm({
      ...INITIAL_LEASE,
      landlord_id: defaultLandlordId ? String(defaultLandlordId) : "",
      property_id: defaultPropertyId ? String(defaultPropertyId) : "",
    });
  }, [
    setIsCreating,
    setIsEditing,
    setSelectedTenantId,
    setTenantForm,
    setLeaseForm,
    defaultLandlordId,
    defaultPropertyId,
  ]);

  const onStartEdit = useCallback(() => {
    if (!selectedTenant) return;
    setIsCreating(false);
    setIsEditing(true);

    setTenantForm({
      title: selectedTenant.title || "",
      full_name: selectedTenant.full_name || "",
      phone: selectedTenant.phone || "",
      email: selectedTenant.email || "",
      national_id: selectedTenant.national_id || "",
      emergency_contact: selectedTenant.emergency_contact || "",
      emergency_phone: selectedTenant.emergency_phone || "",
      status: selectedTenant.status || "active",
    });

    // When editing:
    // - If there's an active lease, edit that lease.
    // - Otherwise, prefill landlord/property/unit from the latest lease, but set lease_id=""
    //   so saving will create a new lease (useful for archived/ended tenants).
    const activeLease =
      (leases || []).find((l) => l.status === "active") || null;
    const latestLease = (leases || [])[0] || null;

    if (activeLease) {
      setLeaseForm({
        ...INITIAL_LEASE,
        lease_id: String(activeLease.id || ""),
        landlord_id: activeLease.landlord_id
          ? String(activeLease.landlord_id)
          : "",
        property_id: activeLease.property_id
          ? String(activeLease.property_id)
          : "",
        unit_id: activeLease.unit_id ? String(activeLease.unit_id) : "",
        start_date: iso(activeLease.start_date),
        end_date: iso(activeLease.end_date),
        monthly_rent:
          activeLease.monthly_rent !== null &&
          activeLease.monthly_rent !== undefined
            ? String(activeLease.monthly_rent)
            : "",
        currency: activeLease.currency || "UGX",
        deposit_amount:
          activeLease.deposit_amount !== null &&
          activeLease.deposit_amount !== undefined
            ? String(activeLease.deposit_amount)
            : "",
        billing_day: Number(activeLease.billing_day || 1),
        auto_renew: activeLease.auto_renew === true,
      });
      return;
    }

    if (latestLease) {
      setLeaseForm({
        ...INITIAL_LEASE,
        lease_id: "", // important: saving will create a new lease
        landlord_id: latestLease.landlord_id
          ? String(latestLease.landlord_id)
          : "",
        property_id: latestLease.property_id
          ? String(latestLease.property_id)
          : "",
        unit_id: latestLease.unit_id ? String(latestLease.unit_id) : "",
        start_date: "",
        end_date: "",
        monthly_rent:
          latestLease.monthly_rent !== null &&
          latestLease.monthly_rent !== undefined
            ? String(latestLease.monthly_rent)
            : "",
        currency: latestLease.currency || "UGX",
        deposit_amount: "",
        billing_day: Number(latestLease.billing_day || 1),
        auto_renew: false,
      });
      return;
    }

    setLeaseForm(INITIAL_LEASE);
  }, [
    selectedTenant,
    leases,
    setIsCreating,
    setIsEditing,
    setTenantForm,
    setLeaseForm,
  ]);

  const onSaveTenant = useCallback(() => {
    const tenantPayload = {
      title: tenantForm.title || null,
      full_name: tenantForm.full_name,
      phone: tenantForm.phone,
      email: tenantForm.email || null,
      national_id: tenantForm.national_id || null,
      emergency_contact: tenantForm.emergency_contact || null,
      emergency_phone: tenantForm.emergency_phone || null,
      status: tenantForm.status,
    };

    if (isCreating) {
      const unitId = Number(leaseForm.unit_id);
      const monthlyRent = Number(leaseForm.monthly_rent);

      const combinedPayload = {
        ...tenantPayload,
        landlord_id: leaseForm.landlord_id
          ? Number(leaseForm.landlord_id)
          : null,
        property_id: leaseForm.property_id
          ? Number(leaseForm.property_id)
          : null,
        unit_id: unitId,
        start_date: leaseForm.start_date,
        end_date: leaseForm.end_date,
        monthly_rent: monthlyRent,
        currency: leaseForm.currency,
        deposit_amount:
          leaseForm.deposit_amount === ""
            ? null
            : Number(leaseForm.deposit_amount),
        billing_day: Number(leaseForm.billing_day) || 1,
        auto_renew: leaseForm.auto_renew === true,
      };

      createTenantWithLeaseMutation.mutate(combinedPayload, {
        onSuccess: (data) => {
          const id = data?.tenant?.id || null;
          if (id) setSelectedTenantId(id);
          setIsCreating(false);
          setTenantForm(INITIAL_TENANT);
          setLeaseForm(INITIAL_LEASE);
        },
      });
      return;
    }

    if (isEditing && selectedTenantId) {
      // Save tenant first
      updateTenantMutation.mutate(
        { id: selectedTenantId, payload: tenantPayload },
        {
          onSuccess: () => {
            const leaseId = leaseForm.lease_id
              ? Number(leaseForm.lease_id)
              : null;

            // If there's an existing active lease, update it.
            if (leaseId && updateLeaseMutation) {
              const leasePayload = {
                unit_id: Number(leaseForm.unit_id),
                start_date: leaseForm.start_date,
                end_date: leaseForm.end_date,
                monthly_rent: Number(leaseForm.monthly_rent),
                currency: leaseForm.currency,
                deposit_amount:
                  leaseForm.deposit_amount === ""
                    ? null
                    : Number(leaseForm.deposit_amount),
              };

              updateLeaseMutation.mutate(
                { id: leaseId, payload: leasePayload },
                {
                  onSuccess: () => {
                    setIsEditing(false);
                  },
                },
              );
              return;
            }

            // Otherwise, create a brand new lease for this tenant.
            if (createLeaseMutation) {
              const payload = {
                tenant_id: selectedTenantId,
                unit_id: Number(leaseForm.unit_id),
                start_date: leaseForm.start_date,
                end_date: leaseForm.end_date,
                monthly_rent: Number(leaseForm.monthly_rent),
                currency: leaseForm.currency,
                deposit_amount:
                  leaseForm.deposit_amount === ""
                    ? null
                    : Number(leaseForm.deposit_amount),
                billing_day: Number(leaseForm.billing_day) || 1,
                auto_renew: leaseForm.auto_renew === true,
              };

              createLeaseMutation.mutate(payload, {
                onSuccess: () => {
                  setIsEditing(false);
                },
              });
              return;
            }

            setIsEditing(false);
          },
        },
      );
    }
  }, [
    tenantForm,
    leaseForm,
    isCreating,
    isEditing,
    selectedTenantId,
    createTenantWithLeaseMutation,
    updateTenantMutation,
    updateLeaseMutation,
    createLeaseMutation,
    setSelectedTenantId,
    setIsCreating,
    setTenantForm,
    setLeaseForm,
    setIsEditing,
  ]);

  const onCreateLease = useCallback(() => {
    if (!selectedTenantId) return;

    const payload = {
      tenant_id: selectedTenantId,
      unit_id: Number(leaseForm.unit_id),
      start_date: leaseForm.start_date,
      end_date: leaseForm.end_date,
      monthly_rent: Number(leaseForm.monthly_rent),
      currency: leaseForm.currency,
      deposit_amount:
        leaseForm.deposit_amount === ""
          ? null
          : Number(leaseForm.deposit_amount),
      billing_day: Number(leaseForm.billing_day) || 1,
      auto_renew: leaseForm.auto_renew === true,
    };

    createLeaseMutation.mutate(payload, {
      onSuccess: () => {
        setLeaseForm(INITIAL_LEASE);
      },
    });
  }, [createLeaseMutation, leaseForm, selectedTenantId, setLeaseForm]);

  const onLandlordChange = useCallback(
    (nextLandlordId) => {
      setLeaseForm((p) => ({
        ...p,
        landlord_id: nextLandlordId,
        property_id: "",
        unit_id: "",
      }));
    },
    [setLeaseForm],
  );

  const onPropertyChange = useCallback(
    (nextPropertyId) => {
      setLeaseForm((p) => ({
        ...p,
        property_id: nextPropertyId,
        unit_id: "",
      }));
    },
    [setLeaseForm],
  );

  const onUnitChange = useCallback(
    (nextUnitId) => {
      const unitObj = unitOptions.find(
        (o) => String(o.id) === String(nextUnitId),
      )?.unit;

      setLeaseForm((p) => ({
        ...p,
        unit_id: nextUnitId,
        monthly_rent: p.monthly_rent || (unitObj?.monthly_rent_ugx ?? ""),
      }));
    },
    [unitOptions, setLeaseForm],
  );

  const onCancel = useCallback(() => {
    setIsCreating(false);
    setIsEditing(false);
    setTenantForm(INITIAL_TENANT);
    setLeaseForm(INITIAL_LEASE);
  }, [setIsCreating, setIsEditing, setTenantForm, setLeaseForm]);

  return {
    onStartCreate,
    onStartEdit,
    onSaveTenant,
    onCreateLease,
    onLandlordChange,
    onPropertyChange,
    onUnitChange,
    onCancel,
  };
}
