"use client";

import { useCallback, useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import { fetchJson } from "@/utils/api";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccountingSidebar from "@/components/Shell/AccountingSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import { useCreateManualInvoice } from "@/hooks/useAccounting";
import { PostManualInvoiceForm } from "@/components/Accounting/PostManualInvoiceForm";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function PostManualInvoicePage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const canUseAccounting = staffQuery.data?.permissions?.accounting === true;

  const [leaseId, setLeaseId] = useState("");
  const [date, setDate] = useState(todayYmd);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  // Fetch active leases
  const leasesQuery = useQuery({
    queryKey: ["leases", "active"],
    queryFn: async () => {
      const data = await fetchJson("/api/leases");
      return data.leases || [];
    },
    enabled: !userLoading && !!user && canUseAccounting,
  });

  const createManualInvoiceMutation = useCreateManualInvoice();

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
    if (createManualInvoiceMutation.error) {
      const timer = setTimeout(() => {
        createManualInvoiceMutation.reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [createManualInvoiceMutation.error, createManualInvoiceMutation]);

  // Get currency from selected lease
  const selectedLease = useMemo(() => {
    if (!leaseId) return null;
    const leases = leasesQuery.data || [];
    return leases.find((l) => l.id === Number(leaseId)) || null;
  }, [leaseId, leasesQuery.data]);

  const currency = selectedLease?.currency || "UGX";

  const onSubmit = useCallback(() => {
    // Clear any previous messages
    setSuccessMessage(null);
    createManualInvoiceMutation.reset();

    const payload = {
      lease_id: leaseId ? Number(leaseId) : null,
      invoice_date: date,
      description,
      amount: amount === "" ? null : Number(amount),
    };

    createManualInvoiceMutation.mutate(payload, {
      onSuccess: () => {
        setDescription("");
        setAmount("");
        setLeaseId("");
        setSuccessMessage("Manual invoice created successfully!");
      },
    });
  }, [leaseId, date, description, amount, createManualInvoiceMutation]);

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
        title="Post Manual Invoice"
        message="You don't have access to the accounting module."
      />
    );
  }

  const leases = leasesQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Post Manual Invoice"
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
              Post Manual Invoice
            </h1>
            <p className="text-slate-500 mt-2">
              Create manual invoices for active leases (partial months,
              adjustments)
            </p>
          </div>

          <PostManualInvoiceForm
            leaseId={leaseId}
            date={date}
            description={description}
            amount={amount}
            currency={currency}
            leases={leases}
            onLeaseChange={setLeaseId}
            onDateChange={setDate}
            onDescriptionChange={setDescription}
            onAmountChange={setAmount}
            onSubmit={onSubmit}
            isPending={createManualInvoiceMutation.isPending}
          />

          {successMessage ? (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {createManualInvoiceMutation.error ? (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {createManualInvoiceMutation.error?.message ||
                "Could not create manual invoice."}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
