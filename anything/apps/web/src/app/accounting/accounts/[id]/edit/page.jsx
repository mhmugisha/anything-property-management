"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import { Field } from "@/components/Accounting/Field";
import { fetchJson, putJson } from "@/utils/api";
import AccessDenied from "@/components/Shell/AccessDenied";

const ACCOUNT_TYPES = ["Asset", "Liability", "Income", "Expense", "Equity"];

export default function EditAccountPage({ params }) {
  const id = params?.id;
  const queryClient = useQueryClient();

  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [isActive, setIsActive] = useState(true);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const accountQuery = useQuery({
    queryKey: ["accounting", "account", id],
    queryFn: async () => {
      const data = await fetchJson(`/api/accounting/accounts/${id}`);
      return data.account || null;
    },
    enabled: !userLoading && !!user && canUseAccounting && !!id,
  });

  useEffect(() => {
    if (accountQuery.data) {
      setAccountCode(accountQuery.data.account_code || "");
      setAccountName(accountQuery.data.account_name || "");
      setAccountType(accountQuery.data.account_type || "");
      setIsActive(accountQuery.data.is_active !== false);
    }
  }, [accountQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload) =>
      putJson(`/api/accounting/accounts/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "account", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["accountRegistry", "accounts"],
      });
      if (typeof window !== "undefined") {
        window.location.href = "/accounting?tab=accounts";
      }
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      account_code: accountCode,
      account_name: accountName,
      account_type: accountType,
      is_active: isActive,
    });
  };

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
        title="Edit Account"
        message="You don't have access to the accounting module."
      />
    );
  }

  const canSave = accountCode && accountName && accountType;
  const errorText = updateMutation.error
    ? String(updateMutation.error?.message || "Could not save account")
    : null;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Edit Account"
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
        <div className="p-4 md:p-6 space-y-3 max-w-[90%] mx-auto">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Edit Account
            </h1>
            <p className="text-slate-500">Edit account details</p>
          </div>

          {accountQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading account...</p>
          ) : accountQuery.error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">
              <div className="font-semibold">Failed to load account</div>
              <div className="text-sm mt-1">
                {String(
                  accountQuery.error?.message || "Could not load account",
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                Account details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Account Code">
                  <input
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    placeholder="e.g. 1110"
                  />
                </Field>

                <Field label="Account Name">
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                    placeholder="e.g. Cash on Hand"
                  />
                </Field>

                <Field label="Account Type">
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                  >
                    <option value="">Select type…</option>
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={isActive ? "active" : "inactive"}
                    onChange={(e) => setIsActive(e.target.value === "active")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>

              {errorText ? (
                <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                  {errorText}
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending || !canSave}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
