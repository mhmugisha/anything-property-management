"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { fetchJson, postJson } from "@/utils/api";
import DatePopoverInput from "@/components/DatePopoverInput";

export default function AccountingBackfillPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  }, [now]);
  const defaultTo = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [force, setForce] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["accounting", "backfill", "historical", "status"],
    queryFn: async () => {
      return fetchJson("/api/accounting/backfill/historical");
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  // Query to check if CIL is enabled
  const cilStatusQuery = useQuery({
    queryKey: ["integration", "feature-flags", "cil_enabled"],
    queryFn: async () => {
      const res = await fetch("/api/integration/discovery");
      if (!res.ok) return { cilEnabled: false };
      const data = await res.json();
      return { cilEnabled: data?.cilEnabled === true };
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        dryRun,
        force,
        from: from || null,
        to: to || null,
      };
      return postJson("/api/accounting/backfill/historical", payload);
    },
    onSuccess: async () => {
      await statusQuery.refetch();
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
        title="Historical Backfill"
        message="You don't have access to the accounting module."
      />
    );
  }

  const completed = statusQuery.data?.completed === true;
  const registryCount = statusQuery.data?.registryCount ?? null;
  const transactionsCount = statusQuery.data?.transactionsCount ?? null;
  const looksEmptyButCompleted =
    completed &&
    (registryCount === 0 || registryCount === "0") &&
    (transactionsCount === 0 || transactionsCount === "0");

  const result = runMutation.data || null;
  const errors = result?.errors || [];

  const canRun = !runMutation.isPending;

  const cilEnabled = cilStatusQuery.data?.cilEnabled === true;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Accounting Backfill"
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
        <div className="p-4 md:p-6 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Historical accounting sync
            </h1>
            <p className="text-slate-500">
              This reads your existing property records and posts the matching
              accounting entries via the compatibility layer.
            </p>
          </div>

          {cilEnabled ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              ✓ Accounting integration is enabled and ready to create
              transactions.
            </div>
          ) : null}

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            {looksEmptyButCompleted ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This sync was previously marked completed, but no accounting
                entries were posted (registry and transactions are empty). It’s
                safe to run again now.
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="From (optional)">
                <DatePopoverInput
                  value={from}
                  onChange={setFrom}
                  placeholder="DD-MM-YYYY"
                  className="bg-white"
                />
              </Field>
              <Field label="To (optional)">
                <DatePopoverInput
                  value={to}
                  onChange={setTo}
                  placeholder="DD-MM-YYYY"
                  className="bg-white"
                />
              </Field>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                Dry run (no writes)
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                Force rerun even if marked completed
              </label>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-slate-600">
                Status: {completed ? "completed" : "not completed"}
                {registryCount !== null ? (
                  <span className="text-slate-400">
                    {" "}
                    • Registry: {registryCount}
                  </span>
                ) : null}
                {transactionsCount !== null ? (
                  <span className="text-slate-400">
                    {" "}
                    • Transactions: {transactionsCount}
                  </span>
                ) : null}
              </div>

              <button
                onClick={() => runMutation.mutate()}
                disabled={!canRun}
                className="px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-[#08172c] text-white font-medium disabled:opacity-50"
              >
                {runMutation.isPending ? "Running..." : "Run sync"}
              </button>
            </div>

            {runMutation.isError ? (
              <div className="text-sm text-rose-600">
                {String(runMutation.error?.message || "Sync failed")}
              </div>
            ) : null}

            {result?.stats ? (
              <div className="text-sm text-slate-700">
                <div className="font-semibold">Result</div>
                <pre className="mt-2 text-xs bg-slate-50 border border-slate-100 rounded-xl p-3 overflow-auto">
                  {JSON.stringify(result.stats, null, 2)}
                </pre>
              </div>
            ) : null}

            {errors.length > 0 ? (
              <div className="text-sm text-rose-700">
                <div className="font-semibold">Errors</div>
                <pre className="mt-2 text-xs bg-rose-50 border border-rose-100 rounded-xl p-3 overflow-auto">
                  {JSON.stringify(errors.slice(0, 50), null, 2)}
                </pre>
                {errors.length > 50 ? (
                  <div className="mt-2 text-xs text-rose-600">
                    Showing first 50 errors.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="text-xs text-slate-500">
            Tip: if payouts/deductions fail with “insufficient funds”, record a
            Deposit Funds entry first so the cash/bank account has an opening
            balance.
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
