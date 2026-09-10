"use client";

import { useState } from "react";
import { useUpdateEmployee } from "@/hooks/usePayroll";
import SalaryForm from "./SalaryForm";

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

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-UG", { maximumFractionDigits: 0 });
}

export default function EditEmployeeForm({ employee, onClose, onSuccess }) {
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [form, setForm] = useState({
    full_name: employee.full_name || "",
    position: employee.position || "",
    start_date: employee?.start_date
      ? String(employee.start_date).slice(0, 10)
      : "",
    employee_type: employee.employee_type || "staff",
    phone: employee.phone || "",
    email: employee.email || "",
    payment_method: employee.payment_method || "cash",
    payment_bank_name: employee.payment_bank_name || "",
    payment_account_number: employee.payment_account_number || "",
    payment_account_name: employee.payment_account_name || "",
    payment_phone: employee.payment_phone || "",
    status: employee.status || "active",
    notes: employee.notes || "",
  });
  const mutation = useUpdateEmployee();
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const canSubmit = form.full_name.trim() && form.position.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      full_name: form.full_name.trim(),
      position: form.position.trim(),
      ...(form.start_date ? { start_date: form.start_date } : {}),
      employee_type: form.employee_type,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      payment_method: form.payment_method,
      payment_bank_name: form.payment_bank_name.trim() || null,
      payment_account_number: form.payment_account_number.trim() || null,
      payment_account_name: form.payment_account_name.trim() || null,
      payment_phone: form.payment_phone.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    mutation.mutate({ id: employee.id, payload }, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Edit Employee</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Full Name" required>
          <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
        </FormField>
        <FormField label="Position" required>
          <Input value={form.position} onChange={(e) => set("position", e.target.value)} required />
        </FormField>
        <FormField label="Start Date">
          <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
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
        <FormField label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </FormField>
        <PaymentDetailsFields method={form.payment_method} form={form} set={set} />
        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Optional notes"
          />
        </FormField>

        {/* Read-only salary — changes go through SalaryForm only */}
        <div className="md:col-span-2">
          <FormField label="Current Salary (UGX)">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm text-slate-800 py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-200 min-h-[36px] flex items-center">
                {employee.current_salary
                  ? `${fmtNum(employee.current_salary)} / month`
                  : <span className="text-slate-400">—</span>}
              </span>
              <button
                type="button"
                onClick={() => setShowSalaryForm((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50 whitespace-nowrap"
              >
                {showSalaryForm ? "Cancel" : "Change Salary"}
              </button>
            </div>
          </FormField>
        </div>
      </div>

      {showSalaryForm && (
        <SalaryForm
          employeeId={employee.id}
          onClose={() => setShowSalaryForm(false)}
          onSuccess={() => {
            setShowSalaryForm(false);
            onSuccess?.();
          }}
        />
      )}

      <ErrorBanner error={mutation.error} />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-600 hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || mutation.isPending}
          className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-medium hover:bg-[#08172c] disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
