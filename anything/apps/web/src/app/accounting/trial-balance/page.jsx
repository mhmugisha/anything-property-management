"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useTrialBalance } from "@/hooks/useAccounting";
import { TrialBalanceStatement } from "@/components/Accounting/TrialBalanceStatement";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";
import DatePopoverInput from "@/components/DatePopoverInput";

export default function TrialBalancePage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const printRef = useRef(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, [now]);
  const defaultTo = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qFrom = sp.get("from");
    const qTo = sp.get("to");
    if (qFrom) setFrom(qFrom);
    if (qTo) setTo(qTo);
  }, []);

  const trialBalanceQuery = useTrialBalance(
    { from, to },
    !userLoading && !!user && canUseAccounting,
  );

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
        title="Trial Balance"
        message="You don't have access to the accounting module."
      />
    );
  }

  const rows = trialBalanceQuery.data?.rows || [];
  const totals = trialBalanceQuery.data?.totals || null;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Trial Balance"
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
        <div
          ref={printRef}
          className="max-w-[90%] mx-auto p-4 md:p-6 space-y-2"
        >
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-2">
              <h1 className="text-2xl font-semibold text-slate-800">
                Trial Balance
              </h1>
              <div className="sm:ml-auto" data-no-print="true">
                <PrintPreviewButtons
                  targetRef={printRef}
                  title="Trial Balance"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="From">
                <DatePopoverInput
                  value={from}
                  onChange={setFrom}
                  placeholder="DD-MM-YYYY"
                  className="bg-white"
                />
              </Field>
              <Field label="To">
                <DatePopoverInput
                  value={to}
                  onChange={setTo}
                  placeholder="DD-MM-YYYY"
                  className="bg-white"
                />
              </Field>
              <div className="text-xs text-slate-500 flex items-end">
                Totals per account.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <TrialBalanceStatement
              rows={rows}
              totals={totals}
              isLoading={trialBalanceQuery.isLoading}
              error={trialBalanceQuery.error}
            />
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
