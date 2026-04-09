"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useCreateJournalEntry } from "@/hooks/useAccounting";
import { useAccountRegistry } from "@/hooks/useAccountRegistry";
import { JournalEntryForm } from "@/components/Accounting/JournalEntryForm";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewEntryCompanyPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  // Use authoritative Chart of Accounts via the Account Registry
  const accountRegistry = useAccountRegistry(
    !userLoading && !!user && canUseAccounting,
  );
  const accountsQuery = accountRegistry.query;

  const createJournalMutation = useCreateJournalEntry();

  const [date, setDate] = useState(todayYmd);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [debitAccount, setDebitAccount] = useState("");
  const [creditAccount, setCreditAccount] = useState("");
  const [amount, setAmount] = useState("");

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Auto-dismiss error message after 3 seconds
  useEffect(() => {
    if (createJournalMutation.error) {
      const timer = setTimeout(() => {
        createJournalMutation.reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [createJournalMutation.error, createJournalMutation]);

  const accountOptions = useMemo(() => {
    const accounts = accountRegistry.accounts || [];
    const active = accounts.filter((a) => a.is_active !== false);
    return active.map((a) => ({
      id: a.id,
      label: `${a.account_code} • ${a.account_name}`,
      type: a.account_type,
    }));
  }, [accountRegistry.accounts]);

  const onSubmit = useCallback(() => {
    // Clear any previous messages
    setSuccessMessage(null);
    createJournalMutation.reset();

    const payload = {
      transaction_date: date,
      description,
      reference_number: reference || null,
      debit_account_id: debitAccount ? Number(debitAccount) : null,
      credit_account_id: creditAccount ? Number(creditAccount) : null,
      amount: amount === "" ? null : Number(amount),
      currency: "UGX",
    };

    createJournalMutation.mutate(payload, {
      onSuccess: () => {
        setDescription("");
        setReference("");
        setDebitAccount("");
        setCreditAccount("");
        setAmount("");
        setSuccessMessage("Journal entry created successfully!");
      },
    });
  }, [
    date,
    description,
    reference,
    debitAccount,
    creditAccount,
    amount,
    createJournalMutation,
  ]);

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
        title="New entry (company)"
        message="You don't have access to the accounting module."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="New entry (company)"
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
        <div className="p-4 md:p-6 max-w-[90%] mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-800">
              General Journal Entry
            </h1>
            <p className="text-slate-500 mt-2">
              Record a company-level journal entry
            </p>
          </div>

          <JournalEntryForm
            date={date}
            description={description}
            reference={reference}
            debitAccount={debitAccount}
            creditAccount={creditAccount}
            amount={amount}
            accountOptions={accountOptions}
            onDateChange={setDate}
            onDescriptionChange={setDescription}
            onReferenceChange={setReference}
            onDebitChange={setDebitAccount}
            onCreditChange={setCreditAccount}
            onAmountChange={setAmount}
            onSubmit={onSubmit}
            isPending={createJournalMutation.isPending}
            error={createJournalMutation.error}
            successMessage={successMessage}
          />

          {accountsQuery.isLoading ? (
            <div className="text-sm text-slate-500 text-center mt-4">
              Loading accounts…
            </div>
          ) : accountsQuery.error ? (
            <div className="text-sm text-rose-600 text-center mt-4">
              Could not load accounts.
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
