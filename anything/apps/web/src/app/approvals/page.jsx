"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import DashboardSidebar from "@/components/Shell/DashboardSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { fetchJson } from "@/utils/api";

async function processApproval({ type, id, action, rejected_reason }) {
  const res = await fetch(`/api/approvals/${type}/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, rejected_reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to process approval");
  }
  return res.json();
}

const TYPE_LABELS = {
  payments: "Payments",
  invoices: "Invoices",
  transactions: "Transactions",
  tenantDeductions: "Tenant Deductions",
  landlordDeductions: "Landlord Deductions",
  landlords: "Landlords",
  properties: "Properties",
  tenants: "Tenants",
};

const TYPE_API_KEYS = {
  payments: "payments",
  invoices: "invoices",
  transactions: "transactions",
  tenantDeductions: "tenant_deductions",
  landlordDeductions: "landlord_deductions",
  landlords: "landlords",
  properties: "properties",
  tenants: "tenants",
};

function formatAmount(amount, currency) {
  if (amount == null) return "—";
  return `${currency || "UGX"} ${Number(amount).toLocaleString()}`;
}

function EntryCard({ entry, typeKey, onApprove, onReject, isPending }) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = () => {
    onReject(entry.id, rejectReason);
    setShowRejectInput(false);
    setRejectReason("");
  };

  const date =
    entry.payment_date ||
    entry.invoice_date ||
    entry.transaction_date ||
    entry.deduction_date ||
    entry.created_at;

  const description =
    entry.description ||
    entry.notes ||
    "—";

  const amount = entry.amount;
  const currency = entry.currency || "UGX";
  const createdBy = entry.created_by_name || "—";
  const tenantName = entry.tenant_name || null;
  const landlordName = entry.landlord_name || null;
  const propertyName = entry.property_name || null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-800 truncate">{description}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {date ? String(date).slice(0, 10) : "—"}
            {propertyName ? ` • ${propertyName}` : ""}
            {tenantName ? ` • ${tenantName}` : ""}
            {landlordName ? ` • ${landlordName}` : ""}
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">
          {formatAmount(amount, currency)}
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Created by: <span className="font-medium text-slate-700">{createdBy}</span>
      </div>

      {showRejectInput ? (
        <div className="space-y-2">
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Confirm Reject
            </button>
            <button
              onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
              className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(entry.id)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={() => setShowRejectInput(true)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 text-sm font-medium"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function SectionGroup({ label, entries, typeKey, onApprove, onReject, isPending, CardComponent = EntryCard }) {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
        {label} <span className="text-slate-400 font-normal">({entries.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {entries.map((entry) => (
          <CardComponent
            key={entry.id}
            entry={entry}
            typeKey={typeKey}
            onApprove={onApprove}
            onReject={onReject}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

function EntityCard({ entry, typeKey, onApprove, onReject, isPending }) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = () => {
    onReject(entry.id, rejectReason);
    setShowRejectInput(false);
    setRejectReason("");
  };

  const createdBy = entry.created_by_name || "—";

  let title = "—";
  let details = [];

  if (typeKey === "landlords") {
    title = entry.full_name || "—";
    details = [
      entry.phone && `Phone: ${entry.phone}`,
      entry.email && `Email: ${entry.email}`,
    ].filter(Boolean);
  } else if (typeKey === "properties") {
    title = entry.property_name || "—";
    const feeType = String(entry.management_fee_type || "percent").toLowerCase();
    const feeDisplay =
      feeType === "fixed"
        ? `Fixed UGX ${Number(entry.management_fee_fixed_amount || 0).toLocaleString()}`
        : `${Number(entry.management_fee_percent || 0)}% of rent`;
    details = [
      entry.landlord_name && `Landlord: ${entry.landlord_name}`,
      `Fee: ${feeDisplay}`,
    ].filter(Boolean);
  } else if (typeKey === "tenants") {
    title = entry.full_name || "—";
    details = [
      entry.phone && `Phone: ${entry.phone}`,
      entry.email && `Email: ${entry.email}`,
    ].filter(Boolean);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="min-w-0">
        <div className="font-medium text-slate-800 truncate">{title}</div>
        {details.length > 0 && (
          <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
            {details.map((d, i) => <div key={i}>{d}</div>)}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        Created by: <span className="font-medium text-slate-700">{createdBy}</span>
      </div>

      {showRejectInput ? (
        <div className="space-y-2">
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Confirm Reject
            </button>
            <button
              onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
              className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(entry.id)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
          <button
            onClick={() => setShowRejectInput(true)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 text-sm font-medium"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const isAdmin = staffQuery.data?.role_name === "Admin";
  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const approvalsQuery = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => fetchJson("/api/approvals"),
    enabled: !userLoading && !!user && isAdmin && canUseAccounting,
  });

  const approvalMutation = useMutation({
    mutationFn: processApproval,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  const handleApprove = useCallback((typeApiKey) => (id) => {
    approvalMutation.mutate({ type: typeApiKey, id, action: "approve", rejected_reason: null });
  }, [approvalMutation]);

  const handleReject = useCallback((typeApiKey) => (id, reason) => {
    approvalMutation.mutate({ type: typeApiKey, id, action: "reject", rejected_reason: reason || null });
  }, [approvalMutation]);

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

  if (!isAdmin) {
    return (
      <AccessDenied
        title="Pending Approvals"
        message="Only Admins can view and process pending approvals."
      />
    );
  }

  const data = approvalsQuery.data || {};
  const payments = data.payments || [];
  const invoices = data.invoices || [];
  const transactions = data.transactions || [];
  const tenantDeductions = data.tenantDeductions || [];
  const landlordDeductions = data.landlordDeductions || [];
  const landlords = data.landlords || [];
  const properties = data.properties || [];
  const tenants = data.tenants || [];

  const totalPending =
    payments.length +
    invoices.length +
    transactions.length +
    tenantDeductions.length +
    landlordDeductions.length +
    landlords.length +
    properties.length +
    tenants.length;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Pending Approvals"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="dashboard"
      />
      <Sidebar active="dashboard">
        <DashboardSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Pending Approvals
              </h1>
              <p className="text-slate-500 mt-1">
                Review and approve or reject entries created by staff
              </p>
            </div>
            {totalPending > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                <Clock className="w-4 h-4" />
                {totalPending} pending
              </div>
            )}
          </div>

          {approvalMutation.error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {approvalMutation.error.message}
            </div>
          )}

          {approvalsQuery.isLoading ? (
            <p className="text-slate-500 text-sm">Loading pending approvals…</p>
          ) : approvalsQuery.error ? (
            <p className="text-rose-600 text-sm">Could not load approvals.</p>
          ) : totalPending === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-slate-400 text-sm mt-1">No pending approvals at this time.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <SectionGroup
                label={TYPE_LABELS.payments}
                entries={payments}
                typeKey="payments"
                onApprove={handleApprove(TYPE_API_KEYS.payments)}
                onReject={handleReject(TYPE_API_KEYS.payments)}
                isPending={approvalMutation.isPending}
              />
              <SectionGroup
                label={TYPE_LABELS.invoices}
                entries={invoices}
                typeKey="invoices"
                onApprove={handleApprove(TYPE_API_KEYS.invoices)}
                onReject={handleReject(TYPE_API_KEYS.invoices)}
                isPending={approvalMutation.isPending}
              />
              <SectionGroup
                label={TYPE_LABELS.transactions}
                entries={transactions}
                typeKey="transactions"
                onApprove={handleApprove(TYPE_API_KEYS.transactions)}
                onReject={handleReject(TYPE_API_KEYS.transactions)}
                isPending={approvalMutation.isPending}
              />
              <SectionGroup
                label={TYPE_LABELS.tenantDeductions}
                entries={tenantDeductions}
                typeKey="tenantDeductions"
                onApprove={handleApprove(TYPE_API_KEYS.tenantDeductions)}
                onReject={handleReject(TYPE_API_KEYS.tenantDeductions)}
                isPending={approvalMutation.isPending}
              />
              <SectionGroup
                label={TYPE_LABELS.landlordDeductions}
                entries={landlordDeductions}
                typeKey="landlordDeductions"
                onApprove={handleApprove(TYPE_API_KEYS.landlordDeductions)}
                onReject={handleReject(TYPE_API_KEYS.landlordDeductions)}
                isPending={approvalMutation.isPending}
              />
              <SectionGroup
                label={TYPE_LABELS.landlords}
                entries={landlords}
                typeKey="landlords"
                onApprove={handleApprove(TYPE_API_KEYS.landlords)}
                onReject={handleReject(TYPE_API_KEYS.landlords)}
                isPending={approvalMutation.isPending}
                CardComponent={EntityCard}
              />
              <SectionGroup
                label={TYPE_LABELS.properties}
                entries={properties}
                typeKey="properties"
                onApprove={handleApprove(TYPE_API_KEYS.properties)}
                onReject={handleReject(TYPE_API_KEYS.properties)}
                isPending={approvalMutation.isPending}
                CardComponent={EntityCard}
              />
              <SectionGroup
                label={TYPE_LABELS.tenants}
                entries={tenants}
                typeKey="tenants"
                onApprove={handleApprove(TYPE_API_KEYS.tenants)}
                onReject={handleReject(TYPE_API_KEYS.tenants)}
                isPending={approvalMutation.isPending}
                CardComponent={EntityCard}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
