"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import { useEmployeeDetail } from "@/hooks/usePayroll";
import EmployeeStatement from "@/components/Payroll/EmployeeStatement";
import { ArrowLeft, User } from "lucide-react";

export default function EmployeeViewDetailsPage() {
  const [employeeId, setEmployeeId] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) setEmployeeId(Number(id));
    }
  }, []);

  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const canView = staffQuery.data?.permissions?.payroll === true;

  const detailQuery = useEmployeeDetail(
    employeeId,
    !userLoading && !!user && canView && !!employeeId,
  );
  const employee = detailQuery.data?.employee || null;

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

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Access denied</p>
      </div>
    );
  }

  const typeBadge =
    employee?.employee_type === "casual"
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";

  const statusBadge =
    employee?.status === "terminated"
      ? "bg-rose-100 text-rose-700"
      : employee?.status === "inactive"
        ? "bg-slate-100 text-slate-600"
        : "bg-emerald-100 text-emerald-700";

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader title="Employee Details" active="payroll" />

      <main className="pt-32">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {/* Back link */}
          <div className="mb-4">
            <a
              href="/payroll"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Payroll
            </a>
          </div>

          {detailQuery.isLoading ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Loading employee details...</p>
            </div>
          ) : detailQuery.error ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-rose-600">Could not load employee details.</p>
            </div>
          ) : !employee ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Employee not found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {employee.full_name}
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {employee.phone}
                        {employee.email ? ` • ${employee.email}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${typeBadge}`}>
                      {employee.employee_type}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${statusBadge}`}>
                      {employee.status || "active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statement */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <EmployeeStatement employeeId={employeeId} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
