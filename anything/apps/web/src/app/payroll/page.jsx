"use client";

import { useState, useCallback, useMemo } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import AccessDenied from "@/components/Shell/AccessDenied";
import {
  useEmployees,
  useEmployeeDetail,
  useCreateEmployee,
  useAddEmployeeSalary,
  useAdvances,
  useCreateAdvance,
  useLoans,
  useCreateLoan,
  useLoanSchedule,
  usePayrollAssetAccounts,
} from "@/hooks/usePayroll";
import {
  Users,
  TrendingUp,
  BookOpen,
  ClipboardList,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Check,
  Briefcase,
} from "lucide-react";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function addMonths(month, year, n) {
  const m = ((month - 1 + n) % 12) + 1;
  const y = year + Math.floor((month - 1 + n) / 12);
  return { month: m, year: y };
}

// ─── Nav sidebar tabs ─────────────────────────────────────────────────────────

const TABS = [
  { key: "employees", label: "Employees", icon: Users },
  { key: "advances", label: "Advances", icon: TrendingUp },
  { key: "loans", label: "Loans", icon: BookOpen },
  { key: "runs", label: "Payroll Runs", icon: ClipboardList },
  { key: "payslips", label: "Payslips", icon: FileText },
];

function PayrollSidebar({ active, onSelect }) {
  return (
    <div className="space-y-1">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
              isActive
                ? "bg-white/15 text-white font-medium"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-base">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Badge({ type }) {
  const map = {
    staff: "bg-blue-100 text-blue-800",
    casual: "bg-purple-100 text-purple-800",
    outstanding: "bg-amber-100 text-amber-800",
    partial: "bg-orange-100 text-orange-800",
    recovered: "bg-green-100 text-green-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-slate-100 text-slate-500",
    inactive: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[type] || "bg-gray-100 text-gray-600"}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      {...props}
    >
      {children}
    </select>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  const msg = error?.message || String(error);
  return (
    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {msg}
    </div>
  );
}

// Primary action button — dark navy matching app style
function PrimaryBtn({ children, disabled, onClick, type = "button" }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-sm font-medium hover:bg-[#08172c] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// ─── EMPLOYEES TAB ────────────────────────────────────────────────────────────

function PaymentDetailsFields({ method, form, set }) {
  if (method === "bank") {
    return (
      <>
        <FormField label="Bank Name" required>
          <Input
            value={form.payment_bank_name}
            onChange={(e) => set("payment_bank_name", e.target.value)}
            placeholder="e.g. Stanbic Bank"
            required
          />
        </FormField>
        <FormField label="Account Number" required>
          <Input
            value={form.payment_account_number}
            onChange={(e) => set("payment_account_number", e.target.value)}
            placeholder="Bank account number"
            required
          />
        </FormField>
      </>
    );
  }
  if (method === "momo") {
    return (
      <>
        <FormField label="Account Name" required>
          <Input
            value={form.payment_account_name}
            onChange={(e) => set("payment_account_name", e.target.value)}
            placeholder="Registered MoMo name"
            required
          />
        </FormField>
        <FormField label="MoMo Phone Number" required>
          <Input
            value={form.payment_phone}
            onChange={(e) => set("payment_phone", e.target.value)}
            placeholder="+256 700 000000"
            required
          />
        </FormField>
      </>
    );
  }
  return null;
}

function NewEmployeeForm({ onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    full_name: "",
    position: "",
    start_date: today,
    employee_type: "staff",
    phone: "",
    email: "",
    payment_method: "cash",
    payment_bank_name: "",
    payment_account_number: "",
    payment_account_name: "",
    payment_phone: "",
    initial_salary: "",
    salary_effective_date: "",
    notes: "",
  });

  const createMutation = useCreateEmployee();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // When start_date changes, auto-fill salary_effective_date if blank
  const handleStartDateChange = (v) => {
    set("start_date", v);
    if (!form.salary_effective_date) set("salary_effective_date", v);
  };

  const canSubmit =
    form.full_name.trim() &&
    form.position.trim() &&
    form.start_date &&
    form.initial_salary &&
    Number(form.initial_salary) > 0 &&
    (form.payment_method === "cash" ||
      (form.payment_method === "bank" &&
        form.payment_bank_name.trim() &&
        form.payment_account_number.trim()) ||
      (form.payment_method === "momo" &&
        form.payment_account_name.trim() &&
        form.payment_phone.trim()));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      full_name: form.full_name.trim(),
      position: form.position.trim(),
      start_date: form.start_date,
      employee_type: form.employee_type,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      payment_method: form.payment_method,
      payment_bank_name: form.payment_bank_name.trim() || null,
      payment_account_number: form.payment_account_number.trim() || null,
      payment_account_name: form.payment_account_name.trim() || null,
      payment_phone: form.payment_phone.trim() || null,
      notes: form.notes.trim() || null,
      initial_salary: Number(form.initial_salary),
      salary_effective_date: form.salary_effective_date || form.start_date,
    };
    createMutation.mutate(payload, { onSuccess });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">New Employee</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="John Doe"
              required
            />
          </FormField>

          <FormField label="Position" required>
            <Input
              value={form.position}
              onChange={(e) => set("position", e.target.value)}
              placeholder="e.g. Property Manager"
              required
            />
          </FormField>

          <FormField label="Start Date" required>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Type">
            <Select value={form.employee_type} onChange={(e) => set("employee_type", e.target.value)}>
              <option value="staff">Staff</option>
              <option value="casual">Casual</option>
            </Select>
          </FormField>

          <FormField label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+256 700 000000" />
          </FormField>

          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="john@example.com" />
          </FormField>

          <FormField label="Payment Method">
            <Select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="momo">Mobile Money</option>
            </Select>
          </FormField>

          <PaymentDetailsFields method={form.payment_method} form={form} set={set} />

          <FormField label="Starting Salary (UGX)" required>
            <Input
              type="number"
              min="1"
              value={form.initial_salary}
              onChange={(e) => set("initial_salary", e.target.value)}
              placeholder="Monthly salary"
              required
            />
          </FormField>

          <FormField label="Salary Effective Date" required>
            <Input
              type="date"
              value={form.salary_effective_date || form.start_date}
              onChange={(e) => set("salary_effective_date", e.target.value)}
              required
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes"
            />
          </FormField>
        </div>

        <ErrorBanner error={createMutation.error} />

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50">
            Cancel
          </button>
          <PrimaryBtn type="submit" disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? "Saving…" : "Create Employee"}
          </PrimaryBtn>
        </div>
      </form>
    </div>
  );
}

function SalaryForm({ employeeId, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [notes, setNotes] = useState("");
  const mutation = useAddEmployeeSalary();

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(
      { id: employeeId, payload: { amount: Number(amount), effective_date: effectiveDate, notes: notes.trim() || null } },
      { onSuccess },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <p className="text-xs font-medium text-slate-700">Change Salary</p>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="New Amount (UGX)" required>
          <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </FormField>
        <FormField label="Effective Date" required>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </FormField>
      </div>
      <FormField label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for change" />
      </FormField>
      <ErrorBanner error={mutation.error} />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!amount || mutation.isPending}
          className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-medium hover:bg-[#08172c] disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Salary"}
        </button>
      </div>
    </form>
  );
}

function EmployeeRow({ employee, expanded, onToggle }) {
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const detailQuery = useEmployeeDetail(employee.id, expanded);
  const detail = detailQuery.data || null;

  const paymentSummary = () => {
    const m = employee.payment_method;
    if (m === "bank") {
      return [
        employee.payment_bank_name,
        employee.payment_account_number,
      ].filter(Boolean).join(" · ") || "Bank";
    }
    if (m === "momo") {
      return [
        employee.payment_account_name,
        employee.payment_phone,
      ].filter(Boolean).join(" · ") || "MoMo";
    }
    return "Cash";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800">{employee.full_name}</span>
            <Badge type={employee.employee_type} />
            {employee.status === "inactive" && <Badge type="inactive" />}
          </div>
          {employee.position && (
            <div className="text-sm text-slate-600 mt-0.5">{employee.position}</div>
          )}
          <div className="text-sm text-slate-500 mt-0.5">
            {paymentSummary()}
            {employee.current_salary ? ` · ${fmt(employee.current_salary)}/mo` : " · No salary set"}
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {detailQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              {/* Details */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {employee.phone && <div><span className="text-slate-500">Phone: </span>{employee.phone}</div>}
                {employee.email && <div><span className="text-slate-500">Email: </span>{employee.email}</div>}
                {employee.start_date && <div><span className="text-slate-500">Start Date: </span>{fmtDate(employee.start_date)}</div>}
                {employee.payment_method === "bank" && employee.payment_bank_name && (
                  <div><span className="text-slate-500">Bank: </span>{employee.payment_bank_name}</div>
                )}
                {employee.payment_method === "bank" && employee.payment_account_number && (
                  <div><span className="text-slate-500">Account: </span>{employee.payment_account_number}</div>
                )}
                {employee.payment_method === "momo" && employee.payment_account_name && (
                  <div><span className="text-slate-500">MoMo Name: </span>{employee.payment_account_name}</div>
                )}
                {employee.payment_method === "momo" && employee.payment_phone && (
                  <div><span className="text-slate-500">MoMo Phone: </span>{employee.payment_phone}</div>
                )}
                {employee.notes && <div className="col-span-2"><span className="text-slate-500">Notes: </span>{employee.notes}</div>}
              </div>

              {/* Salary history */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Salary History</p>
                  {!showSalaryForm && (
                    <button
                      onClick={() => setShowSalaryForm(true)}
                      className="text-xs text-slate-600 underline hover:text-slate-800"
                    >
                      Change Salary
                    </button>
                  )}
                </div>
                {showSalaryForm && (
                  <SalaryForm
                    employeeId={employee.id}
                    onClose={() => setShowSalaryForm(false)}
                    onSuccess={() => setShowSalaryForm(false)}
                  />
                )}
                {detail?.salary_history?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-gray-100">
                        <th className="text-left py-1 font-medium">Amount</th>
                        <th className="text-left py-1 font-medium">From</th>
                        <th className="text-left py-1 font-medium">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.salary_history.map((s) => (
                        <tr key={s.id} className="border-b border-gray-50">
                          <td className="py-1.5 font-medium">{fmt(s.amount)}</td>
                          <td className="py-1.5 text-slate-600">{fmtDate(s.effective_date)}</td>
                          <td className="py-1.5 text-slate-600">{s.end_date ? fmtDate(s.end_date) : <span className="text-green-600">Current</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-slate-400">No salary records</p>
                )}
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <p className="text-xs text-amber-700 font-medium">Outstanding Advances</p>
                  <p className="text-lg font-bold text-amber-900 mt-0.5">
                    {fmt(detail?.total_outstanding_advances || 0)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">Outstanding Loans</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5">
                    {fmt(detail?.total_outstanding_loans || 0)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmployeesTab() {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const empQuery = useEmployees(
    { status: showInactive ? "all" : "active" },
    true,
  );
  const employees = empQuery.data || [];

  const toggle = useCallback(
    (id) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Employees</h2>
          <p className="text-sm text-slate-500">{employees.length} {showInactive ? "total" : "active"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            {showInactive ? "Show active only" : "Show all"}
          </button>
          <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-4 h-4" />
            New Employee
          </PrimaryBtn>
        </div>
      </div>

      {showForm && (
        <NewEmployeeForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {empQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading employees…</p>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-dashed border-gray-200">
          No employees found. Add your first employee.
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <EmployeeRow
              key={emp.id}
              employee={emp}
              expanded={expandedId === emp.id}
              onToggle={() => toggle(emp.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADVANCES TAB ─────────────────────────────────────────────────────────────

function NewAdvanceForm({ employees, assetAccounts, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employee_id: "",
    amount: "",
    advance_date: today,
    payment_account_id: "",
    description: "",
  });
  const mutation = useCreateAdvance();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(
      {
        employee_id: Number(form.employee_id),
        amount: Number(form.amount),
        advance_date: form.advance_date,
        payment_account_id: Number(form.payment_account_id),
        description: form.description.trim() || null,
      },
      { onSuccess },
    );
  };

  const canSubmit = form.employee_id && form.amount && form.payment_account_id;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">New Advance</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Employee" required>
            <Select value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Amount (UGX)" required>
            <Input type="number" min="1" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </FormField>

          <FormField label="Date" required>
            <Input type="date" value={form.advance_date} onChange={(e) => set("advance_date", e.target.value)} required />
          </FormField>

          <FormField label="Paid From Account" required>
            <Select value={form.payment_account_id} onChange={(e) => set("payment_account_id", e.target.value)} required>
              <option value="">Select account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Description">
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional reason" />
          </FormField>
        </div>

        <ErrorBanner error={mutation.error} />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50">
            Cancel
          </button>
          <PrimaryBtn type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Record Advance"}
          </PrimaryBtn>
        </div>
      </form>
    </div>
  );
}

function AdvancesTab() {
  const [showForm, setShowForm] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const advQuery = useAdvances({
    employee_id: filterEmployeeId || null,
    status: filterStatus || null,
  });
  const empQuery = useEmployees({ status: "active" });
  const employees = empQuery.data || [];

  const data = advQuery.data || {};
  const advances = data.advances || [];
  const totalOutstanding = data.total_outstanding || 0;

  const assetAccountsQuery = usePayrollAssetAccounts();
  const assetAccounts = assetAccountsQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Staff Advances</h2>
          <p className="text-sm text-slate-500">{advances.length} records</p>
        </div>
        <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" />
          New Advance
        </PrimaryBtn>
      </div>

      {/* Summary card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Total Outstanding Advances</p>
        <p className="text-2xl font-bold text-amber-900 mt-1">{fmt(totalOutstanding)}</p>
      </div>

      {showForm && (
        <NewAdvanceForm
          employees={employees}
          assetAccounts={assetAccounts}
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} className="max-w-xs">
          <option value="">All employees</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="max-w-[160px]">
          <option value="">All statuses</option>
          <option value="outstanding">Outstanding</option>
          <option value="partial">Partial</option>
          <option value="recovered">Recovered</option>
        </Select>
      </div>

      {advQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : advances.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-dashed border-gray-200">
          No advances found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outstanding</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {advances.map((adv) => (
                <tr key={adv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{adv.employee_name}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmt(adv.amount)}</td>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(adv.advance_date)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(adv.outstanding)}</td>
                  <td className="px-5 py-3"><Badge type={adv.status} /></td>
                  <td className="px-5 py-3 text-slate-500">{adv.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── LOANS TAB ────────────────────────────────────────────────────────────────

function LoanScheduleModal({ loanId, onClose }) {
  const schedQuery = useLoanSchedule(loanId, true);
  const data = schedQuery.data || {};
  const loan = data.loan || null;
  const schedule = data.schedule || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-semibold text-slate-800">Repayment Schedule</div>
            {loan && <div className="text-xs text-slate-500 mt-0.5">{loan.employee_name} · {fmt(loan.amount)}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {schedQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              {loan && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="font-semibold text-slate-800">{fmt(loan.amount)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-700">Outstanding</p>
                    <p className="font-semibold text-amber-900">{fmt(loan.outstanding)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-600">Instalment</p>
                    <p className="font-semibold text-slate-800">{fmt(loan.monthly_instalment)}</p>
                  </div>
                </div>
              )}
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Month</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {schedule.map((s) => (
                    <tr key={s.instalment_number} className={s.status === "paid" ? "opacity-50" : ""}>
                      <td className="py-2 text-slate-400">{s.instalment_number}</td>
                      <td className="py-2">{s.month_label}</td>
                      <td className="py-2 text-right">{fmt(s.amount)}</td>
                      <td className="py-2">
                        {s.status === "paid" ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs"><Check className="w-3 h-3" /> Paid</span>
                        ) : (
                          <span className="text-xs text-slate-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewLoanForm({ employees, assetAccounts, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const [form, setForm] = useState({
    employee_id: "",
    amount: "",
    monthly_instalment: "",
    issue_date: today,
    start_month: String(now.getMonth() + 1),
    start_year: String(now.getFullYear()),
    payment_account_id: "",
    description: "",
  });
  const mutation = useCreateLoan();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const totalInstalments = form.amount && form.monthly_instalment && Number(form.monthly_instalment) > 0
    ? Math.ceil(Number(form.amount) / Number(form.monthly_instalment))
    : null;

  const endPeriod = totalInstalments && form.start_month && form.start_year
    ? addMonths(Number(form.start_month), Number(form.start_year), totalInstalments - 1)
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(
      {
        employee_id: Number(form.employee_id),
        amount: Number(form.amount),
        monthly_instalment: Number(form.monthly_instalment),
        issue_date: form.issue_date,
        start_month: Number(form.start_month),
        start_year: Number(form.start_year),
        payment_account_id: Number(form.payment_account_id),
        description: form.description.trim() || null,
      },
      { onSuccess },
    );
  };

  const canSubmit = form.employee_id && form.amount && form.monthly_instalment && form.payment_account_id;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Issue Loan</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Employee" required>
            <Select value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Loan Amount (UGX)" required>
            <Input type="number" min="1" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </FormField>

          <FormField label="Monthly Instalment (UGX)" required>
            <Input type="number" min="1" value={form.monthly_instalment} onChange={(e) => set("monthly_instalment", e.target.value)} required />
          </FormField>

          <FormField label="Issue Date" required>
            <Input type="date" value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} required />
          </FormField>

          <FormField label="Start Month" required>
            <Select value={form.start_month} onChange={(e) => set("start_month", e.target.value)} required>
              {MONTH_NAMES.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Start Year" required>
            <Input
              type="number"
              min="2020"
              max="2040"
              value={form.start_year}
              onChange={(e) => set("start_year", e.target.value)}
              required
            />
          </FormField>

          <FormField label="Paid From Account" required>
            <Select value={form.payment_account_id} onChange={(e) => set("payment_account_id", e.target.value)} required>
              <option value="">Select account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Description">
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Loan purpose" />
          </FormField>
        </div>

        {totalInstalments && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700">
            <strong>{totalInstalments} instalments</strong> ending{" "}
            {endPeriod ? `${MONTH_NAMES[endPeriod.month]} ${endPeriod.year}` : "—"}
          </div>
        )}

        <ErrorBanner error={mutation.error} />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-600 hover:bg-gray-50">
            Cancel
          </button>
          <PrimaryBtn type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Issue Loan"}
          </PrimaryBtn>
        </div>
      </form>
    </div>
  );
}

function LoansTab() {
  const [showForm, setShowForm] = useState(false);
  const [schedLoanId, setSchedLoanId] = useState(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");

  const loansQuery = useLoans({
    employee_id: filterEmployeeId || null,
    status: filterStatus || null,
  });
  const empQuery = useEmployees({ status: "active" });
  const employees = empQuery.data || [];

  const data = loansQuery.data || {};
  const loans = data.loans || [];
  const totalOutstanding = data.total_outstanding || 0;

  const assetAccountsQuery = usePayrollAssetAccounts();
  const assetAccounts = assetAccountsQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Staff Loans</h2>
          <p className="text-sm text-slate-500">{loans.length} loans</p>
        </div>
        <PrimaryBtn onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" />
          Issue Loan
        </PrimaryBtn>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-600 font-medium uppercase tracking-wide">Total Outstanding Loans</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{fmt(totalOutstanding)}</p>
      </div>

      {showForm && (
        <NewLoanForm
          employees={employees}
          assetAccounts={assetAccounts}
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      <div className="flex gap-3">
        <Select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} className="max-w-xs">
          <option value="">All employees</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="max-w-[160px]">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      {loansQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-dashed border-gray-200">
          No loans found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Loan</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Monthly</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Remaining</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outstanding</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{loan.employee_name}</td>
                  <td className="px-5 py-3 text-right">{fmt(loan.amount)}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{fmt(loan.monthly_instalment)}</td>
                  <td className="px-5 py-3 text-center text-slate-600">
                    {loan.remaining_instalments > 0
                      ? `${loan.remaining_instalments} mo`
                      : <span className="text-green-600">Done</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(loan.outstanding)}</td>
                  <td className="px-5 py-3"><Badge type={loan.status} /></td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setSchedLoanId(loan.id)}
                      className="text-xs text-slate-600 underline hover:text-slate-800 whitespace-nowrap"
                    >
                      View Schedule
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {schedLoanId && (
        <LoanScheduleModal loanId={schedLoanId} onClose={() => setSchedLoanId(null)} />
      )}
    </div>
  );
}

// ─── PLACEHOLDER TABS ─────────────────────────────────────────────────────────

function PlaceholderTab({ label }) {
  return (
    <div className="bg-white rounded-2xl p-16 text-center border border-dashed border-gray-200">
      <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 font-medium">{label}</p>
      <p className="text-slate-400 text-sm mt-1">Coming soon in Payroll Part 2</p>
    </div>
  );
}

// ─── PAGE ROOT ────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("employees");

  const canView = staffQuery.data?.permissions?.payroll === true;
  const isLoading = userLoading || staffQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
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
      <AccessDenied
        title="Payroll"
        message="You don't have access to manage payroll."
      />
    );
  }

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
        <PayrollSidebar active={activeTab} onSelect={setActiveTab} />
      </Sidebar>

      <main className="pt-32 md:pl-56">
        <div className="max-w-[90%] mx-auto p-4 md:p-6">
          {activeTab === "employees" && <EmployeesTab />}
          {activeTab === "advances" && <AdvancesTab />}
          {activeTab === "loans" && <LoansTab />}
          {activeTab === "runs" && <PlaceholderTab label="Payroll Runs" />}
          {activeTab === "payslips" && <PlaceholderTab label="Payslips" />}
        </div>
      </main>
    </div>
  );
}
