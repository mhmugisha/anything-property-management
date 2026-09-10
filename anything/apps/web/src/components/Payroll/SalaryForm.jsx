"use client";

import { useState } from "react";
import { useAddEmployeeSalary } from "@/hooks/usePayroll";

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

function ErrorBanner({ error }) {
  if (!error) return null;
  const msg = error?.message || String(error);
  return (
    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {msg}
    </div>
  );
}

export default function SalaryForm({ employeeId, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [notes, setNotes] = useState("");
  const mutation = useAddEmployeeSalary();

  const handleSave = () => {
    mutation.mutate(
      { id: employeeId, payload: { amount: Number(amount), effective_date: effectiveDate, notes: notes.trim() || null } },
      { onSuccess },
    );
  };

  return (
    <div className="space-y-3 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <p className="text-xs font-medium text-slate-700">Change Salary</p>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="New Amount (UGX)" required>
          <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Effective Date" required>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
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
          type="button"
          onClick={handleSave}
          disabled={!amount || mutation.isPending}
          className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-medium hover:bg-[#08172c] disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Salary"}
        </button>
      </div>
    </div>
  );
}
