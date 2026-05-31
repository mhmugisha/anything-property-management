"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import MaintenanceSidebar from "@/components/Shell/MaintenanceSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import {
  useMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useApproveMaintenance,
} from "@/hooks/useMaintenance";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import {
  Plus,
  Save,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export default function MaintenancePage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canManageMaintenance =
    staffQuery.data?.permissions?.maintenance === true;

  const isAdmin = staffQuery.data?.role_name === "Admin";

  const maintenanceQuery = useMaintenance(
    !userLoading && !!user && canManageMaintenance,
  );
  const createMutation = useCreateMaintenance();
  const updateMutation = useUpdateMaintenance();
  const approveMutation = useApproveMaintenance();

  const [formOpen, setFormOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [cost, setCost] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");

  // Completion modal state
  const [showClosed, setShowClosed] = useState(false);

  const [completionItem, setCompletionItem] = useState(null);
  const [completedCost, setCompletedCost] = useState("");
  const [completedDate, setCompletedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [chargeType, setChargeType] = useState("company");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [refError, setRefError] = useState("");

  const propertiesQuery = useQuery({
    queryKey: ["lookups", "properties"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/properties");
      return data.properties || [];
    },
    enabled: !userLoading && !!user,
  });

  const unitsQuery = useQuery({
    queryKey: ["lookups", "units", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const data = await fetchJson(
        `/api/lookups/units?propertyId=${propertyId}`,
      );
      return data.units || [];
    },
    enabled: !userLoading && !!user && !!propertyId,
  });

  const tenantsQuery = useQuery({
    queryKey: ["lookups", "tenants"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/tenants");
      return data.tenants || [];
    },
    enabled: !userLoading && !!user,
  });

  const accountsQuery = useQuery({
    queryKey: ["maintenance", "accounts"],
    queryFn: async () => {
      const data = await fetchJson("/api/maintenance/accounts");
      return data.accounts || [];
    },
    enabled: !userLoading && !!user && canManageMaintenance,
  });

  const requests = maintenanceQuery.data || [];

  const grouped = useMemo(() => {
    const pending = [];
    const inProgress = [];
    const completed = [];
    const closed = [];

    for (const r of requests) {
      if (r.status === "closed") closed.push(r);
      else if (r.status === "completed") completed.push(r);
      else if (r.status === "in_progress") inProgress.push(r);
      else pending.push(r);
    }

    return { pending, inProgress, completed, closed };
  }, [requests]);

  const isLoading = userLoading || staffQuery.isLoading;

  const onCreate = useCallback(() => {
    const payload = {
      title,
      description: description || null,
      category: category || null,
      priority,
      status: "pending",
      assigned_to: assignedTo || null,
      cost: cost === "" ? null : Number(cost),
      property_id: propertyId ? Number(propertyId) : null,
      unit_id: unitId ? Number(unitId) : null,
      tenant_id: tenantId ? Number(tenantId) : null,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false);
        setTitle("");
        setDescription("");
        setCategory("");
        setPriority("medium");
        setAssignedTo("");
        setCost("");
        setPropertyId("");
        setUnitId("");
        setTenantId("");
      },
    });
  }, [
    title,
    description,
    category,
    priority,
    assignedTo,
    cost,
    propertyId,
    unitId,
    tenantId,
    createMutation,
  ]);

  const onMove = useCallback(
    (reqId, nextStatus) => {
      updateMutation.mutate({ id: reqId, payload: { status: nextStatus } });
    },
    [updateMutation],
  );

  const onApprove = useCallback(
    (reqId) => {
      approveMutation.mutate(reqId);
    },
    [approveMutation],
  );

  const openCompletionModal = useCallback((item) => {
    setCompletionItem(item);
    setCompletedCost(item.cost != null ? String(item.cost) : "");
    setCompletedDate(new Date().toISOString().slice(0, 10));
    setChargeType("company");
    setPaymentAccountId("");
    setReferenceNumber("");
    setRefError("");
  }, []);

  const openEditClosedModal = useCallback((item) => {
    setCompletionItem(item);
    setCompletedCost(item.completed_cost != null ? String(item.completed_cost) : "");
    setCompletedDate(
      item.completed_date
        ? String(item.completed_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setChargeType(item.charge_type || "company");
    setPaymentAccountId(
      item.payment_account_id != null ? String(item.payment_account_id) : "",
    );
    setReferenceNumber(item.reference_number || "");
    setRefError("");
  }, []);

  const closeCompletionModal = useCallback(() => {
    setCompletionItem(null);
    setRefError("");
  }, []);

  const onConfirmComplete = useCallback(() => {
    if (!completionItem) return;
    const isEditingClosed = completionItem.status === "closed";
    const hasCost = completedCost !== "" && Number(completedCost) > 0;
    if (hasCost && !referenceNumber.trim()) {
      setRefError("Reference number is required");
      return;
    }
    setRefError("");
    const payload = isEditingClosed
      ? {
          completed_cost: hasCost ? Number(completedCost) : null,
          completed_date: completedDate,
          charge_type: chargeType,
          payment_account_id: paymentAccountId ? Number(paymentAccountId) : null,
          reference_number: referenceNumber.trim() || null,
        }
      : {
          status: "completed",
          ...(hasCost
            ? {
                completed_cost: Number(completedCost),
                completed_date: completedDate,
                charge_type: chargeType,
                payment_account_id: paymentAccountId ? Number(paymentAccountId) : null,
                reference_number: referenceNumber.trim(),
              }
            : {}),
        };
    updateMutation.mutate(
      { id: completionItem.id, payload },
      { onSuccess: closeCompletionModal },
    );
  }, [
    completionItem,
    completedCost,
    completedDate,
    chargeType,
    paymentAccountId,
    referenceNumber,
    updateMutation,
    closeCompletionModal,
  ]);

  const onClose = useCallback(
    (reqId) => {
      updateMutation.mutate(
        { id: reqId, payload: { action: "close" } },
        {
          onError: (e) => alert(e?.message || "Could not close request."),
        },
      );
    },
    [updateMutation],
  );

  const onCancel = useCallback(
    (reqId) => {
      if (!confirm("Cancel this request? This cannot be undone.")) return;
      updateMutation.mutate(
        { id: reqId, payload: { action: "cancel" } },
        {
          onError: (e) => alert(e?.message || "Could not cancel request."),
        },
      );
    },
    [updateMutation],
  );

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

  if (!canManageMaintenance) {
    return (
      <AccessDenied
        title="Maintenance"
        message="You don't have access to view maintenance requests."
      />
    );
  }

  const properties = propertiesQuery.data || [];
  const units = unitsQuery.data || [];
  const tenants = tenantsQuery.data || [];
  const accounts = accountsQuery.data || [];

  const createError = createMutation.error;
  const isCreating = createMutation.isPending;

  // Landlord name for completion modal
  const completionProperty = completionItem?.property_id
    ? properties.find((p) => p.id === completionItem.property_id)
    : null;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Maintenance"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="maintenance"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="maintenance"
      />
      <Sidebar active="maintenance">
        <MaintenanceSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="p-4 md:p-6">
          <div className="max-w-[90%] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-800">
                  Maintenance
                </h1>
                <p className="text-slate-500">
                  Track issues by status and approvals
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showClosed}
                    onChange={(e) => setShowClosed(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Show closed
                </label>
                <button
                  onClick={() => setFormOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
                >
                  <Plus className="w-4 h-4" />
                  New request
                </button>
              </div>
            </div>

            {formOpen ? (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-3">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Create request
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field label="Title">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                      placeholder="e.g. Broken window"
                    />
                  </Field>

                  <Field label="Priority">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </Field>

                  <Field label="Category (optional)">
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                      placeholder="Plumbing / Electrical / ..."
                    />
                  </Field>

                  <Field label="Property (optional)">
                    <select
                      value={propertyId}
                      onChange={(e) => {
                        setPropertyId(e.target.value);
                        setUnitId("");
                        setTenantId("");
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                    >
                      <option value="">Select property…</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.property_name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Unit (optional)">
                    <select
                      value={unitId}
                      onChange={(e) => {
                        const selectedUnitId = e.target.value;
                        setUnitId(selectedUnitId);

                        if (selectedUnitId) {
                          const selectedUnit = units.find(
                            (u) => u.id === Number(selectedUnitId),
                          );
                          if (selectedUnit?.tenant_id) {
                            setTenantId(String(selectedUnit.tenant_id));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                      disabled={!propertyId}
                    >
                      <option value="">Select unit…</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.unit_number} ({u.status})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Tenant (optional)">
                    <select
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                    >
                      <option value="">Select tenant…</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Assigned to (optional)">
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                      placeholder="Staff/Vendor name"
                    />
                  </Field>

                  <Field label="Cost (UGX, optional)">
                    <input
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                      placeholder="e.g. 450000"
                    />
                  </Field>

                  <Field label="Description (optional)">
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                    />
                  </Field>
                </div>

                {createError ? (
                  <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                    Could not create request.
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={onCreate}
                    disabled={isCreating || !title}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isCreating ? "Saving..." : "Save request"}
                  </button>
                  <button
                    onClick={() => setFormOpen(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  Expenses above UGX 500,000 are marked as "approval required".
                </div>
              </div>
            ) : null}

            <div className={`grid grid-cols-1 gap-2 ${showClosed ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              <KanbanColumn
                title="Pending"
                subtitle="New or waiting"
                items={grouped.pending}
                onMove={onMove}
                onApprove={onApprove}
                onComplete={openCompletionModal}
                onEditClosed={openEditClosedModal}
                onClose={onClose}
                onCancel={onCancel}
                isAdmin={isAdmin}
                isUpdating={
                  updateMutation.isPending || approveMutation.isPending
                }
              />
              <KanbanColumn
                title="In progress"
                subtitle="Being worked on"
                items={grouped.inProgress}
                onMove={onMove}
                onApprove={onApprove}
                onComplete={openCompletionModal}
                onEditClosed={openEditClosedModal}
                onClose={onClose}
                onCancel={onCancel}
                isAdmin={isAdmin}
                isUpdating={
                  updateMutation.isPending || approveMutation.isPending
                }
              />
              <KanbanColumn
                title="Completed"
                subtitle="Done"
                items={grouped.completed}
                onMove={onMove}
                onApprove={onApprove}
                onComplete={openCompletionModal}
                onEditClosed={openEditClosedModal}
                onClose={onClose}
                onCancel={onCancel}
                isAdmin={isAdmin}
                isUpdating={
                  updateMutation.isPending || approveMutation.isPending
                }
                isCompleted
              />
              {showClosed ? (
                <KanbanColumn
                  title="Closed"
                  subtitle="Archived"
                  items={grouped.closed}
                  onMove={onMove}
                  onApprove={onApprove}
                  onComplete={openCompletionModal}
                  onEditClosed={openEditClosedModal}
                  onClose={onClose}
                  onCancel={onCancel}
                  isAdmin={isAdmin}
                  isUpdating={
                    updateMutation.isPending || approveMutation.isPending
                  }
                  isClosed
                />
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {/* Completion modal */}
      {completionItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              {completionItem.status === "closed" ? "Edit Completion" : "Mark as Completed"}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {completionItem.title}
            </p>

            <div className="space-y-3">
              <Field label="Actual cost (UGX)">
                <input
                  type="number"
                  value={completedCost}
                  onChange={(e) => setCompletedCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  placeholder="Leave blank to skip GL entry"
                />
              </Field>

              <Field label="Date paid">
                <input
                  type="date"
                  value={completedDate}
                  onChange={(e) => setCompletedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                />
              </Field>

              <Field label="Charge to">
                <select
                  value={chargeType}
                  onChange={(e) => setChargeType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                >
                  <option value="company">Company</option>
                  <option value="landlord">
                    Landlord
                    {completionProperty?.landlord_name
                      ? ` (${completionProperty.landlord_name})`
                      : ""}
                  </option>
                </select>
              </Field>

              <Field label="Paid from">
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} – {a.account_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={`Reference / Voucher #${completedCost !== "" && Number(completedCost) > 0 ? " *" : " (optional)"}`}>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => {
                    setReferenceNumber(e.target.value);
                    if (refError) setRefError("");
                  }}
                  className={`w-full px-3 py-2 rounded-lg border bg-gray-50 outline-none ${
                    refError ? "border-rose-400" : "border-gray-200"
                  }`}
                  placeholder="e.g. MV-2026-001"
                />
                {refError ? (
                  <div className="mt-1 text-[11px] text-rose-600">
                    {refError}
                  </div>
                ) : null}
              </Field>
            </div>

            {updateMutation.error ? (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                {updateMutation.error?.message || "Could not complete request."}
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={onConfirmComplete}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {updateMutation.isPending ? "Saving…" : "Confirm completion"}
              </button>
              <button
                onClick={closeCompletionModal}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}

function KanbanColumn({
  title,
  subtitle,
  items,
  onMove,
  onApprove,
  onComplete,
  onEditClosed,
  onClose,
  onCancel,
  isAdmin,
  isUpdating,
  isCompleted,
  isClosed,
}) {
  const headerColor = isClosed
    ? "text-slate-500"
    : isCompleted
      ? "text-green-700"
      : "text-slate-800";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="mb-3">
        <div className={`text-sm font-semibold ${headerColor}`}>{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-slate-500 text-center">
          No items
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <MaintenanceCard
              key={r.id}
              item={r}
              onMove={onMove}
              onApprove={onApprove}
              onComplete={onComplete}
              onEditClosed={onEditClosed}
              onClose={onClose}
              onCancel={onCancel}
              isAdmin={isAdmin}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaintenanceCard({ item, onMove, onApprove, onComplete, onEditClosed, onClose, onCancel, isAdmin, isUpdating }) {
  const propertyName = item.property_name || "—";
  const unitText = item.unit_number ? `Unit ${item.unit_number}` : "";
  const unitDisplay = unitText ? ` • ${unitText}` : "";

  const costText = item.cost ? formatCurrencyUGX(item.cost) : null;
  const costDisplay = costText ? `Cost (UGX): ${costText}` : "";

  const needsApproval = item.approval_required === true && !item.approved_at;

  const badgeClasses = needsApproval
    ? "bg-orange-100 text-orange-700"
    : item.status === "closed"
      ? "bg-gray-200 text-gray-600"
      : item.status === "completed"
        ? "bg-green-100 text-green-700"
        : item.status === "in_progress"
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-100 text-gray-700";

  const badgeText = needsApproval ? "approval required" : item.status;

  const canApprove = isAdmin && needsApproval;
  const isBlocked = needsApproval;

  const canMoveToInProgress = item.status === "pending";
  const canMoveToCompleted = item.status === "in_progress";
  const canClose = item.status === "completed";
  const canCancel = item.status === "pending" || item.status === "in_progress";

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-slate-800">{item.title}</div>
          <div className="text-xs text-slate-500 mt-1">
            {propertyName}
            {unitDisplay}
          </div>
          {item.assigned_to ? (
            <div className="text-xs text-slate-500 mt-1">
              Assigned: {item.assigned_to}
            </div>
          ) : null}
        </div>

        <span className={`px-2 py-1 text-xs rounded-full ${badgeClasses}`}>
          {badgeText}
        </span>
      </div>

      {item.description ? (
        <div className="text-sm text-slate-600 mt-2">{item.description}</div>
      ) : null}

      {/* Approval warning banner */}
      {isBlocked && !isAdmin ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Awaiting approval before work can proceed
        </div>
      ) : null}

      {/* Completed / closed details */}
      {(item.status === "completed" || item.status === "closed") ? (
        <div className="mt-2 space-y-0.5 text-xs text-slate-500">
          {item.completed_date ? (
            <div>Completed: {String(item.completed_date).slice(0, 10)}</div>
          ) : null}
          {item.completed_cost ? (
            <div>Cost paid: {formatCurrencyUGX(item.completed_cost)}</div>
          ) : null}
          {item.charge_type ? (
            <div>
              Charged to:{" "}
              {item.charge_type === "landlord" ? "Landlord" : "Company"}
            </div>
          ) : null}
          {item.reference_number ? (
            <div>Ref: {item.reference_number}</div>
          ) : null}
          {item.transaction_id ? (
            <div className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              GL posted
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between mt-3">
        <div className="text-sm font-medium text-slate-800">{costDisplay}</div>

        <div className="flex items-center gap-2">
          {canApprove ? (
            <button
              disabled={isUpdating}
              onClick={() => onApprove(item.id)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              Approve
            </button>
          ) : null}

          {canMoveToInProgress ? (
            <button
              disabled={isUpdating || isBlocked}
              onClick={() => !isBlocked && onMove(item.id, "in_progress")}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              Start
            </button>
          ) : null}

          {canMoveToCompleted ? (
            <button
              disabled={isUpdating || isBlocked}
              onClick={() => !isBlocked && onComplete(item)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Done
            </button>
          ) : null}
        </div>
      </div>

      {canClose ? (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            disabled={isUpdating}
            onClick={() => onClose(item.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
          >
            Close Request
          </button>
        </div>
      ) : null}

      {item.status === "closed" ? (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            disabled={isUpdating}
            onClick={() => onEditClosed(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-[#0B1F3A] text-[#0B1F3A] hover:bg-slate-50 disabled:opacity-50"
          >
            Edit Completion
          </button>
        </div>
      ) : null}

      {canCancel ? (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            disabled={isUpdating}
            onClick={() => onCancel(item.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
