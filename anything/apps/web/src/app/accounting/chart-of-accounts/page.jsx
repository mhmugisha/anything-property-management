"use client";

import { useEffect } from "react";

export default function AccountingChartOfAccountsRoute() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.location.href = "/accounting/chart-of-accounts-standalone";
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center font-inter">
      <p className="text-slate-600">Redirecting…</p>
    </div>
  );
}
