"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import LandlordsSidebar from "@/components/Shell/LandlordsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import {
  useLandlords,
  useCreateLandlord,
  useUpdateLandlord,
  useLandlordProperties,
  useLandlordPropertyStatement,
  useCreateLandlordPayout,
  useArchiveLandlord,
  useReactivateLandlord,
  useEndLandlordContractNow,
  useDeleteLandlord,
} from "@/hooks/useLandlords";
import { LandlordForm } from "@/components/Landlords/LandlordForm";
import { LandlordDetails } from "@/components/Landlords/LandlordDetails";
import { useLandlordForm } from "@/hooks/useLandlordForm";
import { useLandlordPayout } from "@/hooks/useLandlordPayout";
import { useLandlordStatement } from "@/hooks/useLandlordStatement";

const initialForm = {
  full_name: "",
  title: "",
  phone: "",
  email: "",
  due_day: "",
  start_date: "",
  end_date: "",
  payment_method: "",
  bank_name: "",
  bank_account_title: "",
  bank_account_number: "",
  mobile_money_name: "",
  mobile_money_phone: "",
};

export default function LandlordsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canView = staffQuery.data?.permissions?.properties === true;
  const canReports = staffQuery.data?.permissions?.reports === true;

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch ALL landlords (no server-side search). The sidebar filters client-side.
  const landlordsQuery = useLandlords(
    { search: "", includeArchived: showArchived === true },
    !userLoading && !!user && !!staffQuery.data && canView,
  );

  const landlords = landlordsQuery.data || [];

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return landlords.find((l) => Number(l.id) === Number(selectedId)) || null;
  }, [landlords, selectedId]);

  const createMutation = useCreateLandlord();
  const updateMutation = useUpdateLandlord();

  const archiveLandlordMutation = useArchiveLandlord();
  const reactivateLandlordMutation = useReactivateLandlord();
  const endContractNowMutation = useEndLandlordContractNow();
  const deleteLandlordMutation = useDeleteLandlord();

  const {
    form,
    setForm,
    isCreating,
    isEditing,
    canSave,
    startCreate,
    startEdit,
    cancel,
    reset,
    setIsCreating,
    setIsEditing,
  } = useLandlordForm(initialForm);

  const landlordIdForProps = selected?.id || null;
  const propertiesQuery = useLandlordProperties(
    landlordIdForProps,
    !!landlordIdForProps &&
      !userLoading &&
      !!user &&
      !!staffQuery.data &&
      canView,
  );
  const properties = propertiesQuery.data || [];

  const {
    statementPropertyId,
    setStatementPropertyId,
    from,
    setFrom,
    to,
    setTo,
  } = useLandlordStatement();

  const statementEnabled =
    !!selected?.id && !!statementPropertyId && canReports === true;

  const statementQuery = useLandlordPropertyStatement(
    {
      landlordId: selected?.id,
      propertyId: statementPropertyId,
      from,
      to,
    },
    statementEnabled,
  );

  const statement = statementQuery.data || null;
  const rows = statement?.rows || [];

  const createPayoutMutation = useCreateLandlordPayout();
  // Track success state
  const [payoutSuccess, setPayoutSuccess] = useState(false);
  // Auto-dismiss payout error after 5 seconds
  useEffect(() => {
    if (!createPayoutMutation.error) return;

    const timer = setTimeout(() => {
      createPayoutMutation.reset();
    }, 5000);

    return () => clearTimeout(timer);
  }, [createPayoutMutation.error, createPayoutMutation]);

  // Auto-dismiss payout success after 5 seconds
  useEffect(() => {
    if (!payoutSuccess) return;

    const timer = setTimeout(() => {
      setPayoutSuccess(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [payoutSuccess]);

  const {
    payoutDate,
    payoutAmount,
    payoutMethod,
    payoutRef,
    setPayoutDate,
    setPayoutAmount,
    setPayoutMethod,
    setPayoutRef,
    resetPayout,
  } = useLandlordPayout();

  const lastAutoPayoutAmountRef = useRef(null);

  useEffect(() => {
    const summary = statementQuery.data?.summary;
    if (!summary) return;

    const closing = Number(summary.closing_balance || 0);
    if (!Number.isFinite(closing)) return;

    const due = Math.max(0, closing);
    const dueText = String(due);

    const shouldAutofill =
      payoutAmount === "" || payoutAmount === lastAutoPayoutAmountRef.current;

    if (!shouldAutofill) return;

    setPayoutAmount(dueText);
    lastAutoPayoutAmountRef.current = dueText;
  }, [statementQuery.data, payoutAmount, setPayoutAmount]);

  const isLoading = userLoading || staffQuery.isLoading;

  const handleStartCreate = useCallback(() => {
    startCreate();
    setSelectedId(null);
  }, [startCreate]);

  const handleStartEdit = useCallback(() => {
    startEdit(selected);
  }, [startEdit, selected]);

  const handleSelectLandlord = useCallback(
    (id) => {
      setSelectedId(id);
      setIsCreating(false);
      setIsEditing(false);
      setStatementPropertyId("");
    },
    [setIsCreating, setIsEditing, setStatementPropertyId],
  );

  const onArchiveLandlord = useCallback(() => {
    if (!selected?.id) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Archive this landlord? This will end all active leases under their properties, make units vacant, and stop auto-invoicing. You can reactivate later.",
      );
      if (!ok) return;
    }

    archiveLandlordMutation.mutate(selected.id, {
      onSuccess: () => {
        setShowArchived(true);
      },
    });
  }, [selected?.id, archiveLandlordMutation]);

  const onReactivateLandlord = useCallback(() => {
    if (!selected?.id) return;
    reactivateLandlordMutation.mutate(selected.id);
  }, [selected?.id, reactivateLandlordMutation]);

  const onEndLeases = useCallback(() => {
    if (!selected?.id) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "End this landlord contract now? This will set the contract end date to today, mark the landlord as ended immediately, end all active leases under their properties, make units vacant, and void future unpaid invoices.",
      );
      if (!ok) return;
    }

    endContractNowMutation.mutate(selected.id, {
      onSuccess: () => {
        setShowArchived(true);
      },
    });
  }, [selected?.id, endContractNowMutation]);

  const onDeleteLandlord = useCallback(() => {
    if (!selected?.id) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Delete this landlord? If they have any properties / payouts / deductions / transactions, deletion will be blocked (archive instead).",
      );
      if (!ok) return;
    }

    deleteLandlordMutation.mutate(selected.id, {
      onSuccess: () => {
        setSelectedId(null);
        setIsCreating(false);
        setIsEditing(false);
        setStatementPropertyId("");
      },
    });
  }, [
    selected?.id,
    deleteLandlordMutation,
    setIsCreating,
    setIsEditing,
    setStatementPropertyId,
  ]);

  const save = useCallback(() => {
    const payload = {
      full_name: form.full_name,
      title: form.title || null,
      phone: form.phone || null,
      email: form.email || null,
      due_day: form.due_day ? Number(form.due_day) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      payment_method: form.payment_method || null,
      bank_name: form.bank_name || null,
      bank_account_title: form.bank_account_title || null,
      bank_account_number: form.bank_account_number || null,
      mobile_money_name: form.mobile_money_name || null,
      mobile_money_phone: form.mobile_money_phone || null,
    };

    if (isCreating) {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          const id = data?.landlord?.id || null;
          if (id) setSelectedId(id);
          setIsCreating(false);
          reset();
        },
      });
      return;
    }

    if (isEditing && selected?.id) {
      updateMutation.mutate(
        { id: selected.id, payload },
        {
          onSuccess: () => {
            setIsEditing(false);
          },
        },
      );
    }
  }, [
    form,
    isCreating,
    isEditing,
    selected,
    createMutation,
    updateMutation,
    reset,
    setIsCreating,
    setIsEditing,
  ]);

  const onRecordPayout = useCallback(() => {
    if (!selected?.id || !statementPropertyId || !payoutDate || !payoutAmount)
      return;

    createPayoutMutation.mutate(
      {
        landlord_id: Number(selected.id),
        property_id: Number(statementPropertyId),
        payout_date: payoutDate,
        amount: Number(payoutAmount),
        payment_method: payoutMethod,
        reference_number: payoutRef || null,
      },
      {
        onSuccess: () => {
          resetPayout();
          setPayoutSuccess(true);
        },
      },
    );
  }, [
    selected,
    statementPropertyId,
    payoutDate,
    payoutAmount,
    payoutMethod,
    payoutRef,
    createPayoutMutation,
    resetPayout,
  ]);

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

  if (!canView) {
    return (
      <AccessDenied
        title="Landlords"
        message="You don't have access to manage landlords."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Landlords"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="landlords"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="landlords"
      />
      <Sidebar active="landlords">
        <LandlordsSidebar
          landlords={landlords}
          isLoading={landlordsQuery.isLoading}
          search={search}
          onSearchChange={setSearch}
          selectedLandlordId={selectedId}
          onSelectLandlord={handleSelectLandlord}
          onCreateNew={handleStartCreate}
          showArchived={showArchived}
          onToggleShowArchived={setShowArchived}
        />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          <div className="space-y-2">
            {isCreating || isEditing ? (
              <LandlordForm
                form={form}
                onFormChange={setForm}
                onSave={save}
                onCancel={cancel}
                isCreating={isCreating}
                isSaving={createMutation.isPending || updateMutation.isPending}
                error={createMutation.error || updateMutation.error}
                canSave={canSave}
              />
            ) : null}

            {!isCreating && !isEditing && selected ? (
              <LandlordDetails
                landlord={selected}
                properties={properties}
                propertiesLoading={propertiesQuery.isLoading}
                selectedPropertyId={statementPropertyId}
                onSelectProperty={setStatementPropertyId}
                onEdit={handleStartEdit}
                payoutDate={payoutDate}
                payoutAmount={payoutAmount}
                payoutMethod={payoutMethod}
                payoutRef={payoutRef}
                onPayoutDateChange={setPayoutDate}
                onPayoutAmountChange={setPayoutAmount}
                onPayoutMethodChange={setPayoutMethod}
                onPayoutRefChange={setPayoutRef}
                onRecordPayout={onRecordPayout}
                payoutSaving={createPayoutMutation.isPending}
                payoutError={createPayoutMutation.error}
                payoutSuccess={payoutSuccess}
                from={from}
                to={to}
                onFromChange={setFrom}
                onToChange={setTo}
                statementLoading={statementQuery.isLoading}
                statementError={statementQuery.error}
                statementRows={rows}
                statementSummary={statement?.summary}
                canReports={canReports}
                onArchive={onArchiveLandlord}
                onReactivate={onReactivateLandlord}
                onEndLeases={onEndLeases}
                onDelete={onDeleteLandlord}
                isArchiving={archiveLandlordMutation.isPending}
                isReactivating={reactivateLandlordMutation.isPending}
                isEndingLeases={endContractNowMutation.isPending}
                isDeleting={deleteLandlordMutation.isPending}
              />
            ) : null}

            {!isCreating && !isEditing && !selected ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm border border-dashed border-gray-200 text-center text-slate-500">
                Select a landlord from the sidebar, or create a new one.
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
