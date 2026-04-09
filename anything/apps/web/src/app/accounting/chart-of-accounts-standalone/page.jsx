"use client";

import { useState, useMemo } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useCreateAccount, useSeedAccounts } from "@/hooks/useAccounting";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";
import { useAccountingHandlers } from "@/hooks/useAccountingHandlers";
import { AccountsTab } from "@/components/Accounting/AccountsTab";

export default function ChartOfAccountsPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("");

  const accountRegistry = useAccountRegistry(
    !userLoading && !!user && canUseAccounting,
  );
  const accountsQuery = accountRegistry.query;

  const createAccountMutation = useCreateAccount();
  const seedAccountsMutation = useSeedAccounts();

  const handlers = useAccountingHandlers({
    accountCode,
    accountName,
    accountType,
    setAccountCode,
    setAccountName,
    setAccountType,
    createAccountMutation,
  });

  const accounts = accountRegistry.accounts || [];

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
        title="Accounting"
        message="You don't have access to the accounting module."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Chart of Accounts"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="accounting"
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
        <div className="p-4 md:p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-slate-800">
              Chart of Accounts
            </h1>
          </div>

          <AccountsTab
            accountCode={accountCode}
            accountName={accountName}
            accountType={accountType}
            onCodeChange={setAccountCode}
            onNameChange={setAccountName}
            onTypeChange={setAccountType}
            onCreateAccount={handlers.onCreateAccount}
            createAccountMutation={createAccountMutation}
            accountsQuery={accountsQuery}
            accounts={accounts}
            seedAccountsMutation={seedAccountsMutation}
          />
        </div>
      </main>
    </div>
  );
}
