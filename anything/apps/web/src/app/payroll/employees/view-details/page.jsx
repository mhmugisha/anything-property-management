"use client";

import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import { useEmployees, useDeleteEmployee } from "@/hooks/usePayroll";
import EmployeeStatement from "@/components/Payroll/EmployeeStatement";
import EditEmployeeForm from "@/components/Payroll/EditEmployeeForm";
import TerminationModal from "@/components/Payroll/TerminationModal";
import { formatDate } from "@/utils/formatDate";
import {
  ArrowLeft, User, Eye, Edit2, MoreVertical, X,
  Users, TrendingUp, BookOpen, ClipboardList, FileText,
} from "lucide-react";

const PAYROLL_TABS = [
  { key: "employees", label: "Employees", icon: Users, href: "/payroll" },
  { key: "advances",  label: "Advances",  icon: TrendingUp, href: "/payroll?tab=advances" },
  { key: "loans",     label: "Loans",     icon: BookOpen,   href: "/payroll?tab=loans" },
  { key: "runs",      label: "Payroll Runs", icon: ClipboardList, href: "/payroll?tab=runs" },
  { key: "payslips",  label: "Payslips",  icon: FileText,   href: "/payroll?tab=payslips" },
];

function PayrollDetailSidebar() {
  return (
    <div className="space-y-1">
      {PAYROLL_TABS.map(({ key, label, icon: Icon, href }) => (
        <a
          key={key}
          href={href}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
            key === "employees"
              ? "bg-white/15 text-white font-medium"
              : "text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="text-base">{label}</span>
        </a>
      ))}
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-800 py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-200 min-h-[36px] flex items-center">
        {value || <span className="text-slate-400">—</span>}
      </span>
    </div>
  );
}

function ViewDetailsPanel({ employee, onClose }) {
  const paymentDetails = (() => {
    if (employee.payment_method === "bank") {
      const parts = [employee.payment_bank_name, employee.payment_account_number].filter(Boolean);
      return parts.length ? parts.join(" · ") : "Bank";
    }
    if (employee.payment_method === "momo") {
      const parts = [employee.payment_account_name, employee.payment_phone].filter(Boolean);
      return parts.length ? parts.join(" · ") : "Mobile Money";
    }
    return "Cash";
  })();

  const paymentMethodLabel =
    employee.payment_method === "bank" ? "Bank Transfer" :
    employee.payment_method === "momo" ? "Mobile Money" :
    "Cash";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Employee Details</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DetailRow label="Full Name" value={employee.full_name} />
        <DetailRow label="Position" value={employee.position} />
        <DetailRow label="Start Date" value={formatDate(employee.start_date)} />
        <DetailRow
          label="Employee Type"
          value={employee.employee_type === "casual" ? "Casual" : "Staff"}
        />
        <DetailRow label="Phone" value={employee.phone} />
        <DetailRow label="Email" value={employee.email} />
        <DetailRow label="Payment Method" value={paymentMethodLabel} />
        {employee.payment_method !== "cash" && (
          <DetailRow label="Payment Details" value={paymentDetails} />
        )}
        <DetailRow
          label="Status"
          value={
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
              employee.status === "terminated" ? "bg-rose-100 text-rose-700" :
              employee.status === "inactive" ? "bg-slate-100 text-slate-600" :
              "bg-emerald-100 text-emerald-700"
            }`}>
              {employee.status || "active"}
            </span>
          }
        />
        <DetailRow
          label="Current Salary"
          value={employee.current_salary ? fmt(employee.current_salary) + " / month" : null}
        />
        {employee.notes && (
          <div className="md:col-span-2">
            <DetailRow label="Notes" value={employee.notes} />
          </div>
        )}
      </div>
    </div>
  );
}

// mode: "statement" | "edit" | "details"
export default function EmployeeViewDetailsPage() {
  // Read ?id synchronously so the query is never disabled on first render
  const [employeeId] = useState(() => {
    if (typeof window === "undefined") return null;
    const id = new URLSearchParams(window.location.search).get("id");
    return id ? Number(id) : null;
  });

  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const canView = staffQuery.data?.permissions?.payroll === true;
  const isAdmin = staffQuery.data?.permissions?.admin === true;

  const employeesQuery = useEmployees(
    { status: "all" },
    !userLoading && !!user && canView && !!employeeId,
    { placeholderData: (prev) => prev },
  );
  const employee = (employeesQuery.data || []).find((e) => e.id === employeeId) || null;

  const deleteMutation = useDeleteEmployee();

  const [mode, setMode] = useState("statement");
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const btnActiveClass =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#0B1F3A] bg-[#0B1F3A] text-white";

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Payroll"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="payroll"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="payroll"
      />
      <Sidebar active="payroll">
        <PayrollDetailSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          {/* Back link */}
          <div className="mb-4">
            <a
              href="/payroll"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Employees
            </a>
          </div>

          {(employeesQuery.isLoading || (employeesQuery.isFetching && !employee)) ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Loading employee details...</p>
            </div>
          ) : employeesQuery.isError && !employee ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-rose-600">Could not load employee details.</p>
            </div>
          ) : !employee ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Employee not found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header card — always visible */}
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
                    <button
                      type="button"
                      onClick={() => {
                        setMode((m) => m === "details" ? "statement" : "details");
                        setShowMoreMenu(false);
                      }}
                      className={mode === "details" ? btnActiveClass : btnClass}
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode((m) => m === "edit" ? "statement" : "edit");
                        setShowMoreMenu(false);
                      }}
                      className={mode === "edit" ? btnActiveClass : btnClass}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>

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
                              setShowDeleteConfirm(true);
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
              </div>

              {/* Content panel — exactly one visible at a time */}
              {mode === "edit" && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <EditEmployeeForm
                    employee={employee}
                    onClose={() => setMode("statement")}
                    onSuccess={() => setMode("statement")}
                  />
                </div>
              )}

              {mode === "details" && (
                <ViewDetailsPanel
                  employee={employee}
                  onClose={() => setMode("statement")}
                />
              )}

              {mode === "statement" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <EmployeeStatement employeeId={employeeId} />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete Employee</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete <strong>{employee.full_name}</strong>?
            </p>
            <p className="text-xs text-slate-500 mb-4">
              This cannot be undone. Employees with payroll history cannot be deleted.
            </p>
            {deleteMutation.error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {deleteMutation.error.message}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  deleteMutation.reset();
                }}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(
                    { id: employeeId },
                    {
                      onSuccess: () => {
                        window.location.href = "/payroll";
                      },
                    },
                  );
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate modal */}
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
