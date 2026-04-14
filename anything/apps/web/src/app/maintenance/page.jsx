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

  const requests = maintenanceQuery.data || [];

  const grouped = useMemo(() => {
    const pending = [];
    const inProgress = [];
    const completed = [];

    for (const r of requests) {
      if (r.status === "completed") completed.push(r);
      else if (r.status === "in_progress") inProgress.push(r);
      else pending.push(r);
    }

    return { pending, inProgress, completed };
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

  const createError = createMutation.error;

  const isCreating = createMutation.isPending;

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
              <button
                onClick={() => setFormOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
              >
                <Plus className="w-4 h-4" />
                New request
              </button>
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

                        // Auto-populate tenant if the selected unit has an active tenant
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
                  Expenses above UGX 500,000 are marked as “approval required”.
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <KanbanColumn
                title="Pending"
                subtitle="New or waiting"
                items={grouped.pending}
                onMove={onMove}
                onApprove={onApprove}
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
                isAdmin={isAdmin}
                isUpdating={
                  updateMutation.isPending || approveMutation.isPending
                }
                isCompleted
              />
            </div>
          </div>
        </div>
      </main>
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
  isAdmin,
  isUpdating,
  isCompleted,
}) {
  const headerColor = isCompleted ? "text-green-700" : "text-slate-800";

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
              isAdmin={isAdmin}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaintenanceCard({ item, onMove, onApprove, isAdmin, isUpdating }) {
  const propertyName = item.property_name || "—";
  const unitText = item.unit_number ? `Unit ${item.unit_number}` : "";
  const unitDisplay = unitText ? ` • ${unitText}` : "";

  const costText = item.cost ? formatCurrencyUGX(item.cost) : null;
  const costDisplay = costText ? `Cost (UGX): ${costText}` : "";

  const needsApproval = item.approval_required === true && !item.approved_at;

  const badgeClasses = needsApproval
    ? "bg-orange-100 text-orange-700"
    : item.status === "completed"
      ? "bg-green-100 text-green-700"
      : item.status === "in_progress"
        ? "bg-blue-100 text-blue-700"
        : "bg-gray-100 text-gray-700";

  const badgeText = needsApproval ? "approval required" : item.status;

  const canApprove = isAdmin && needsApproval;

  const canMoveToInProgress = item.status === "pending";
  const canMoveToCompleted = item.status === "in_progress";

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
              disabled={isUpdating}
              onClick={() => onMove(item.id, "in_progress")}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              Start
            </button>
          ) : null}

          {canMoveToCompleted ? (
            <button
              disabled={isUpdating}
              onClick={() => onMove(item.id, "completed")}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
