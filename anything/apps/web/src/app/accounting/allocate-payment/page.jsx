"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { fetchJson, postJson } from "@/utils/api";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatDate } from "@/utils/formatters";
import { formatCurrencyUGX } from "@/utils/formatCurrency";
import { useTenantLookup } from "@/hooks/usePaymentLookups";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function AllocatePaymentPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const queryClient = useQueryClient();

  const holdingQuery = useQuery({
    queryKey: ["accounting", "holdingUnallocated"],
    queryFn: async () => {
      const data = await fetchJson("/api/accounting/holding-unallocated");
      return data.entries || [];
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  const tenantsQuery = useTenantLookup(
    null,
    !userLoading && !!user && canUseAccounting,
  );

  const closeModal = useCallback(() => setActiveEntry(null), []);

  const allocateMutation = useMutation({
    mutationFn: async (payload) => postJson("/api/payments/allocate", payload),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["accounting", "holdingUnallocated"],
      });
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "accountStatement"],
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setSuccessMessage(
        `Allocated ${formatCurrencyUGX(vars?.amount || 0)} from Holding.`,
      );
      setTimeout(() => setSuccessMessage(""), 4000);
      closeModal();
    },
  });

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

  if (!canUseAccounting) {
    return (
      <AccessDenied
        title="Allocate payment"
        message="You don't have access to the accounting module."
      />
    );
  }

  const entries = holdingQuery.data || [];
  const total = entries.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Allocate payment"
        onMenuToggle={() => setMobileMenuOpen(true)}
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="max-w-[90%] mx-auto p-4 md:p-6 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Allocate payment
            </h1>
            <p className="text-slate-500">
              Clear entries sitting in Holding (2500) by allocating each one to
              a tenant. This posts Dr Holding / Cr Tenant Prepayments and
              auto-applies against open invoices.
            </p>
          </div>

          {successMessage ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-medium">
              {successMessage}
            </div>
          ) : null}

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Unallocated Holding entries
              </h2>
              <div className="text-sm text-slate-500">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"} ·
                Total {formatCurrencyUGX(total)}
              </div>
            </div>

            {holdingQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : holdingQuery.error ? (
              <p className="text-sm text-rose-600">
                Could not load holding entries.
              </p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-slate-500">
                No unallocated holding entries.
              </p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3 text-right">Amount (UGX)</th>
                      <th className="py-2 pr-3">Created by</th>
                      <th className="py-2 pr-3 text-right w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {formatDate(e.transaction_date)}
                        </td>
                        <td className="py-2 pr-3">
                          {e.reference_number || "—"}
                        </td>
                        <td className="py-2 pr-3">{e.description || "—"}</td>
                        <td className="py-2 pr-3 text-right font-medium text-slate-800">
                          {formatCurrencyUGX(e.amount)}
                        </td>
                        <td className="py-2 pr-3">
                          {e.created_by_name || "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <button
                            onClick={() => setActiveEntry(e)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs"
                          >
                            Allocate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {activeEntry ? (
        <AllocateModal
          entry={activeEntry}
          tenants={tenantsQuery.data || []}
          tenantsLoading={tenantsQuery.isLoading}
          onCancel={closeModal}
          onSubmit={(payload) => allocateMutation.mutate(payload)}
          isSaving={allocateMutation.isPending}
          error={allocateMutation.error}
        />
      ) : null}
    </div>
  );
}

function AllocateModal({
  entry,
  tenants,
  tenantsLoading,
  onCancel,
  onSubmit,
  isSaving,
  error,
}) {
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [paymentDate, setPaymentDate] = useState(
    typeof entry.transaction_date === "string"
      ? entry.transaction_date.slice(0, 10)
      : todayYmd(),
  );
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState(
    entry.reference_number || "",
  );
  const [notes, setNotes] = useState("");
  const [refError, setRefError] = useState("");

  useEffect(() => {
    if (!tenantId || tenants.length === 0) {
      setPropertyId("");
      setPropertyName("");
      return;
    }
    const t = tenants.find((x) => String(x.id) === String(tenantId));
    if (t && t.current_property_id) {
      setPropertyId(String(t.current_property_id));
      setPropertyName(t.current_property_name || "");
    } else {
      setPropertyId("");
      setPropertyName("");
    }
  }, [tenantId, tenants]);

  const filteredTenants = useMemo(() => {
    if (!tenantSearch) return tenants;
    const s = tenantSearch.toLowerCase();
    return tenants.filter((t) => {
      const name = (t.full_name || "").toLowerCase();
      const phone = (t.phone || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const prop = (t.current_property_name || "").toLowerCase();
      return (
        name.includes(s) ||
        phone.includes(s) ||
        email.includes(s) ||
        prop.includes(s)
      );
    });
  }, [tenants, tenantSearch]);

  const handleTenantPick = (t) => {
    setTenantId(t.id);
    setTenantSearch(`${t.full_name} (${t.phone})`);
    setShowTenantDropdown(false);
  };

  const canSubmit =
    !!tenantId && !!propertyId && !!paymentDate && !!paymentMethod;

  const handleSubmit = () => {
    if (!referenceNumber || !referenceNumber.trim()) {
      setRefError("Reference number is required");
      return;
    }
    setRefError("");
    if (!canSubmit) return;
    onSubmit({
      holding_transaction_id: Number(entry.id),
      tenant_id: Number(tenantId),
      property_id: Number(propertyId),
      amount: Number(entry.amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference_number: referenceNumber.trim(),
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">
            Allocate holding entry
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Move {formatCurrencyUGX(entry.amount)} out of Holding and into a
            tenant's prepayment balance.
          </p>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-4 text-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">
              Holding entry
            </div>
            <div className="flex justify-between gap-3">
              <span>
                {formatDate(entry.transaction_date)} ·{" "}
                {entry.reference_number || "no reference"}
              </span>
              <span className="font-medium">
                {formatCurrencyUGX(entry.amount)}
              </span>
            </div>
            {entry.description ? (
              <div className="text-xs text-slate-500 mt-1">
                {entry.description}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <Field label="Amount (UGX) — locked to holding entry">
              <input
                value={formatCurrencyUGX(entry.amount)}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none text-slate-700"
              />
              <div className="mt-1 text-[11px] text-slate-500">
                The full holding amount is allocated in one go. To allocate part
                of it, first split the holding entry via a manual journal.
              </div>
            </Field>

            <Field label="Select Tenant">
              <div className="relative">
                <input
                  type="text"
                  value={tenantSearch}
                  onChange={(e) => {
                    setTenantSearch(e.target.value);
                    setShowTenantDropdown(true);
                    if (tenantId) setTenantId("");
                  }}
                  onFocus={() => setShowTenantDropdown(true)}
                  placeholder="Type to search tenants..."
                  disabled={tenantsLoading}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none text-sm"
                />
                {showTenantDropdown && filteredTenants.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full border border-gray-200 rounded-lg max-h-64 overflow-y-auto bg-white shadow-lg">
                    {filteredTenants.slice(0, 8).map((t) => {
                      const propertyInfo = t.current_property_name
                        ? ` • ${t.current_property_name}`
                        : " • No active lease";
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleTenantPick(t)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 text-sm"
                        >
                          {t.full_name} ({t.phone}){propertyInfo}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showTenantDropdown &&
                  tenantSearch &&
                  filteredTenants.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-slate-500 text-xs">
                      No tenants found
                    </div>
                  )}
              </div>
            </Field>

            <Field label="Property (Auto-filled)">
              <input
                type="text"
                value={propertyName || (tenantId ? "No active lease" : "")}
                readOnly
                placeholder={tenantId ? "" : "Select tenant first..."}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none text-sm text-slate-600"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment Date">
                <DatePopoverInput
                  value={paymentDate}
                  onChange={setPaymentDate}
                  placeholder="DD-MM-YYYY"
                  className="bg-white"
                />
              </Field>
              <Field label="Method">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="MTN MoMo">MTN MoMo</option>
                  <option value="Airtel Money">Airtel Money</option>
                </select>
              </Field>
            </div>

            <Field label="Reference number">
              <input
                value={referenceNumber}
                onChange={(e) => {
                  setReferenceNumber(e.target.value);
                  if (refError) setRefError("");
                }}
                className={`w-full px-3 py-2 rounded-lg border bg-white outline-none ${
                  refError ? "border-rose-400" : "border-gray-200"
                }`}
                placeholder="e.g. RCT-001"
              />
              {refError ? (
                <div className="mt-1 text-[11px] text-rose-600">{refError}</div>
              ) : null}
            </Field>

            <Field label="Notes (Optional)">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              />
            </Field>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error?.message || "Could not allocate payment."}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSaving}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? "Allocating..." : "Allocate"}
            </button>
          </div>
        </div>
      </div>
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
