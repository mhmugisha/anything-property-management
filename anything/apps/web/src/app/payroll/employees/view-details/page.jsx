"use client";

import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import { useEmployees } from "@/hooks/usePayroll";
import EmployeeStatement from "@/components/Payroll/EmployeeStatement";
import EditEmployeeForm from "@/components/Payroll/EditEmployeeForm";
import TerminationModal from "@/components/Payroll/TerminationModal";
import { ArrowLeft, User, Eye, Edit2, MoreVertical } from "lucide-react";

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
  const isAdmin = staffQuery.data?.permissions?.admin === true;

  const employeesQuery = useEmployees(
    { status: "all" },
    !userLoading && !!user && canView && !!employeeId,
  );
  const employee = (employeesQuery.data || []).find((e) => e.id === employeeId) || null;

  // Action button state
  const [showEditForm, setShowEditForm] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

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

  const btnClass =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700";

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

          {employeesQuery.isLoading ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Loading employee details...</p>
            </div>
          ) : employeesQuery.error ? (
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
                <div className="flex items-start justify-between gap-4">
                  {/* Left — avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900">
                          {employee.full_name}
                        </h2>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${typeBadge}`}>
                          {employee.employee_type}
                        </span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${statusBadge}`}>
                          {employee.status || "active"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {employee.position}
                        {employee.phone ? ` • ${employee.phone}` : ""}
                        {employee.email ? ` • ${employee.email}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Right — action buttons */}
                  <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                    {/* View Details — placeholder for Stage 2c */}
                    <button
                      type="button"
                      onClick={() => {}}
                      className={btnClass}
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditForm((v) => !v);
                        setShowMoreMenu(false);
                      }}
                      className={btnClass}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>

                    {/* More ⋮ */}
                    <div className="relative" ref={moreMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowMoreMenu((v) => !v)}
                        className={btnClass}
                      >
                        <MoreVertical className="w-4 h-4" />
                        More
                      </button>
                      {showMoreMenu && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                          {employee.status !== "terminated" && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                setShowTerminateModal(true);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
                            >
                              Terminate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setShowMoreMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit form — inline below header */}
                {showEditForm && (
                  <EditEmployeeForm
                    employee={employee}
                    onClose={() => setShowEditForm(false)}
                    onSuccess={() => setShowEditForm(false)}
                  />
                )}
              </div>

              {/* Statement */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <EmployeeStatement employeeId={employeeId} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Terminate modal — portal-style, rendered outside scroll container */}
      {showTerminateModal && employee && (
        <TerminationModal
          employee={employee}
          onClose={() => setShowTerminateModal(false)}
          onSuccess={() => setShowTerminateModal(false)}
        />
      )}
    </div>
  );
}
