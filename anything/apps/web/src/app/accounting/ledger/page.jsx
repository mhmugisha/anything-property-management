"use client";

import { useMemo, useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";

export default function LedgerIndexPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  // Use the authoritative Account Registry (real Chart of Accounts)
  const accountRegistry = useAccountRegistry(
    !userLoading && !!user && canUseAccounting,
  );
  const accountsQuery = accountRegistry.query;

  const isLoading = userLoading || staffQuery.isLoading;

  const accounts = accountRegistry.accounts || [];

  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => a.is_active !== false);
  }, [accounts]);

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
        title="Ledger"
        message="You don't have access to the accounting module."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader title="Ledger" onMenuToggle={() => setMobileMenuOpen(true)} />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="accounting"
      />
      <Sidebar active="accounting">
        <AccountingSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Ledger</h1>
            <p className="text-slate-500">
              Pick an account to view its statement.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {accountsQuery.isLoading ? (
              <p className="text-slate-600">Loading accounts…</p>
            ) : accountsQuery.error ? (
              <p className="text-rose-600">Could not load accounts.</p>
            ) : activeAccounts.length === 0 ? (
              <p className="text-slate-500">No accounts found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {activeAccounts.map((a) => {
                  const label = `${a.account_code} • ${a.account_name}`;
                  return (
                    <a
                      key={a.id}
                      href={`/accounting/accounts/${a.id}`}
                      className="rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50"
                      title={label}
                    >
                      <div className="text-sm font-semibold text-slate-800">
                        {label}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {a.account_type}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
