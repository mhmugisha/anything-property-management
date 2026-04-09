"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import PaymentsSidebar from "@/components/Shell/PaymentsSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
} from "lucide-react";

export default function AutoApplyPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const canManagePayments = staffQuery.data?.permissions?.payments === true;

  const isLoading = userLoading || staffQuery.isLoading;

  // Fetch tenants with unapplied payments
  const fetchTenants = async () => {
    setIsLoadingTenants(true);
    try {
      const response = await fetch("/api/payments/auto-apply");
      if (!response.ok) throw new Error("Failed to fetch tenants");
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (err) {
      console.error("Error fetching tenants:", err);
      setError("Failed to load tenants with unapplied payments");
    } finally {
      setIsLoadingTenants(false);
    }
  };

  useEffect(() => {
    if (canManagePayments && !userLoading) {
      fetchTenants();
    }
  }, [canManagePayments, userLoading]);

  const handleAutoApply = async (tenantId) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/payments/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: parseInt(tenantId) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to auto-apply payments");
        return;
      }

      setResult(data);

      // Refresh tenant list after successful application
      await fetchTenants();
    } catch (err) {
      console.error("Error auto-applying payments:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAll = async () => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/payments/auto-apply-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to auto-apply payments");
        return;
      }

      setResult(data);

      // Refresh tenant list after successful application
      await fetchTenants();
    } catch (err) {
      console.error("Error auto-applying all payments:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter tenants based on search query
  const filteredTenants = tenants.filter(
    (t) =>
      t.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tenantId?.toString().includes(searchQuery),
  );

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

  if (!canManagePayments) {
    return (
      <AccessDenied
        title="Auto Apply Payments"
        message="You don't have access to manage payments."
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Auto Apply Payments"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="payments"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="payments"
      />
      <Sidebar active="payments">
        <PaymentsSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className="p-4 md:p-6 max-w-[90%] mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-800 mb-2">
              Auto Apply Payments on Account
            </h1>
            <p className="text-slate-500">
              Automatically allocate unapplied payments to open invoices
            </p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">This tool helps with:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Applying unapplied advance payments to open invoices</li>
                <li>Fixing payments that weren't automatically allocated</li>
                <li>Processing multiple tenants at once</li>
              </ul>
            </div>
          </div>

          {/* Apply All Button */}
          {tenants.length > 0 && (
            <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-lg p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">
                    Process All Tenants
                  </h3>
                  <p className="text-sm text-slate-600">
                    Apply unapplied payments for all {tenants.length} tenant(s)
                    at once
                  </p>
                </div>
                <button
                  onClick={handleApplyAll}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-semibold justify-center md:justify-end flex-shrink-0"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw
                        className="w-5 h-5"
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Apply All
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Result */}
          {result && result.ok && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-800 text-lg mb-2">
                    Success!
                  </p>
                  <p className="text-green-700 mb-3">{result.message}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-600">Allocations Created:</p>
                      <p className="font-semibold text-green-900">
                        {result.appliedCount || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-600">Total Amount Applied:</p>
                      <p className="font-semibold text-green-900">
                        UGX {(result.appliedAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by tenant name..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tenants List */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                Tenants with Unapplied Payments ({filteredTenants.length})
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Click "Apply" to allocate payments to open invoices
              </p>
            </div>

            {isLoadingTenants ? (
              <div className="p-8 text-center text-slate-600">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-400" />
                <p>Loading tenants...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium">
                  {searchQuery
                    ? "No tenants found matching your search"
                    : "All payments applied!"}
                </p>
                {!searchQuery && (
                  <p className="text-sm mt-1">
                    No tenants have unapplied payments with open invoices.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredTenants.map((tenant) => (
                  <div
                    key={tenant.tenantId}
                    className="p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 mb-2">
                          {tenant.tenantName}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-slate-600">Unapplied: </span>
                            <span className="font-semibold text-sky-700">
                              UGX{" "}
                              {(tenant.unappliedAmount || 0).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">
                              Open Invoices:{" "}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {tenant.openInvoicesCount || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600">
                              Outstanding:{" "}
                            </span>
                            <span className="font-semibold text-orange-700">
                              UGX{" "}
                              {(tenant.totalOutstanding || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAutoApply(tenant.tenantId)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          "Apply"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
