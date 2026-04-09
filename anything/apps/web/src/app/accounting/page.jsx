"use client";

import { useState, useMemo, useCallback } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import {
  useCreateAccount,
  useJournal,
  useCreateJournalEntry,
  useCreateLandlordDeduction,
  useCreateTenantDeduction,
  useTrialBalance,
  useProfitLoss,
  useBalanceSheet,
  useSeedAccounts,
} from "@/hooks/useAccounting";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";
import { useAccountingState } from "@/hooks/useAccountingState";
import { useAccountingHandlers } from "@/hooks/useAccountingHandlers";
import { useAccountingLookups } from "@/hooks/useAccountingLookups";
import { TabNavigation } from "@/components/Accounting/TabNavigation";
import { DateRangeFilter } from "@/components/Accounting/DateRangeFilter";
import { AccountsTab } from "@/components/Accounting/AccountsTab";
import { JournalTab } from "@/components/Accounting/JournalTab";
import { StatementsTab } from "@/components/Accounting/StatementsTab";
import QuickLinkTile from "@/components/QuickLinkTile";

export default function AccountingPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const state = useAccountingState();

  // Account Registry bootstrap (authoritative Chart of Accounts)
  const accountRegistry = useAccountRegistry(
    !userLoading && !!user && canUseAccounting,
  );
  const accountsQuery = accountRegistry.query;

  const createAccountMutation = useCreateAccount();
  const seedAccountsMutation = useSeedAccounts();

  const journalQuery = useJournal(
    { from: state.from, to: state.to },
    !userLoading && !!user && canUseAccounting,
  );
  const createJournalMutation = useCreateJournalEntry();
  const createLandlordDeductionMutation = useCreateLandlordDeduction();
  const createTenantDeductionMutation = useCreateTenantDeduction();

  const trialBalanceQuery = useTrialBalance(
    { from: state.from, to: state.to },
    !userLoading && !!user && canUseAccounting,
  );
  const plQuery = useProfitLoss(
    { from: state.from, to: state.to },
    !userLoading && !!user && canUseAccounting,
  );
  const bsQuery = useBalanceSheet(
    { to: state.to },
    !userLoading && !!user && canUseAccounting,
  );

  const { landlords, properties, tenants } = useAccountingLookups(
    !userLoading && !!user && canUseAccounting,
    { tenantLandlordId: state.tdLandlordId },
  );

  const onTdLandlordChange = useCallback(
    (next) => {
      state.setTdLandlordId(next);
      // reset tenant when landlord changes
      state.setTdTenantId("");
    },
    [state],
  );

  const onLdLandlordChange = useCallback(
    (next) => {
      state.setLdLandlordId(next);
      // reset property when landlord changes
      state.setLdPropertyId("");
    },
    [state],
  );

  const handlers = useAccountingHandlers({
    accountCode: state.accountCode,
    accountName: state.accountName,
    accountType: state.accountType,
    setAccountCode: state.setAccountCode,
    setAccountName: state.setAccountName,
    setAccountType: state.setAccountType,
    createAccountMutation,
    txDate: state.txDate,
    txDescription: state.txDescription,
    txRef: state.txRef,
    txDebit: state.txDebit,
    txCredit: state.txCredit,
    txAmount: state.txAmount,
    setTxDescription: state.setTxDescription,
    setTxRef: state.setTxRef,
    setTxDebit: state.setTxDebit,
    setTxCredit: state.setTxCredit,
    setTxAmount: state.setTxAmount,
    createJournalMutation,
    ldLandlordId: state.ldLandlordId,
    ldPropertyId: state.ldPropertyId,
    ldDate: state.ldDate,
    ldDescription: state.ldDescription,
    ldAmount: state.ldAmount,
    ldSource: state.ldSource,
    setLdDescription: state.setLdDescription,
    setLdAmount: state.setLdAmount,
    createLandlordDeductionMutation,
    tdLandlordId: state.tdLandlordId,
    tdTenantId: state.tdTenantId,
    tdPropertyId: state.tdPropertyId,
    tdDate: state.tdDate,
    tdDescription: state.tdDescription,
    tdAmount: state.tdAmount,
    tdSource: state.tdSource,
    setTdDescription: state.setTdDescription,
    setTdAmount: state.setTdAmount,
    createTenantDeductionMutation,
  });

  // IMPORTANT: UI reads accounts from the Account Registry (hydrated store)
  const accounts = accountRegistry.accounts || [];

  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => a.is_active !== false);
  }, [accounts]);

  const accountOptions = useMemo(() => {
    return activeAccounts.map((a) => {
      const label = `${a.account_code} • ${a.account_name}`;
      return { id: a.id, label, type: a.account_type };
    });
  }, [activeAccounts]);

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

  const showAccounts = state.tab === "accounts";
  const showJournal = state.tab === "journal";
  const showStatements = state.tab === "statements";

  const trialRows = trialBalanceQuery.data?.rows || [];
  const trialTotals = trialBalanceQuery.data?.totals || null;

  const plIncome = plQuery.data?.income || [];
  const plExpenses = plQuery.data?.expenses || [];
  const plTotals = plQuery.data?.totals || null;

  const bsAssets = bsQuery.data?.assets || [];
  const bsLiabilities = bsQuery.data?.liabilities || [];
  const bsEquity = bsQuery.data?.equity || [];
  const bsTotals = bsQuery.data?.totals || null;

  const txRows = journalQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Accounting"
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
        <div className="p-4 md:p-6 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Accounting
              </h1>
              <p className="text-slate-500">
                Chart of accounts, journal, statements, and landlord deductions
              </p>
            </div>

            <TabNavigation activeTab={state.tab} onTabChange={state.setTab} />
          </div>

          <DateRangeFilter
            from={state.from}
            to={state.to}
            onFromChange={state.setFrom}
            onToChange={state.setTo}
          />

          {showAccounts ? (
            <AccountsTab
              accountCode={state.accountCode}
              accountName={state.accountName}
              accountType={state.accountType}
              onCodeChange={state.setAccountCode}
              onNameChange={state.setAccountName}
              onTypeChange={state.setAccountType}
              onCreateAccount={handlers.onCreateAccount}
              createAccountMutation={createAccountMutation}
              accountsQuery={accountsQuery}
              accounts={accounts}
              seedAccountsMutation={seedAccountsMutation}
            />
          ) : null}

          {showJournal ? (
            <JournalTab
              journalQuery={journalQuery}
              transactions={txRows}
              accountOptions={accountOptions}
            />
          ) : null}

          {showStatements ? (
            <StatementsTab from={state.from} to={state.to} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
