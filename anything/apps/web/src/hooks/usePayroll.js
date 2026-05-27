import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson } from "@/utils/api";

// ─── Cash / Bank accounts for payment dropdowns ───────────────────────────────

export function usePayrollAssetAccounts(enabled = true) {
  return useQuery({
    queryKey: ["payroll", "asset-accounts"],
    queryFn: async () => {
      const data = await fetchJson("/api/payroll/accounts");
      return data.accounts || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Employees ────────────────────────────────────────────────────────────────

export function useEmployees(filters, enabled = true) {
  const safe = filters || {};
  return useQuery({
    queryKey: ["payroll", "employees", safe],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safe.status) params.set("status", safe.status);
      const qs = params.toString();
      const data = await fetchJson(`/api/payroll/employees${qs ? `?${qs}` : ""}`);
      return data.employees || [];
    },
    enabled,
  });
}

export function useEmployeeDetail(id, enabled = true) {
  return useQuery({
    queryKey: ["payroll", "employees", id],
    queryFn: async () => fetchJson(`/api/payroll/employees/${id}`),
    enabled: enabled && !!id,
    staleTime: 0,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/payroll/employees", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll", "employees"] });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/payroll/employees/${id}`, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["payroll", "employees"] });
      qc.invalidateQueries({ queryKey: ["payroll", "employees", id] });
    },
  });
}

export function useAddEmployeeSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      postJson(`/api/payroll/employees/${id}/salary`, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["payroll", "employees"] });
      qc.invalidateQueries({ queryKey: ["payroll", "employees", id] });
    },
  });
}

// ─── Advances ─────────────────────────────────────────────────────────────────

export function useAdvances(filters, enabled = true) {
  const safe = filters || {};
  return useQuery({
    queryKey: ["payroll", "advances", safe],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safe.employee_id) params.set("employee_id", String(safe.employee_id));
      if (safe.status) params.set("status", safe.status);
      const qs = params.toString();
      const data = await fetchJson(`/api/payroll/advances${qs ? `?${qs}` : ""}`);
      return data;
    },
    enabled,
  });
}

export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/payroll/advances", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll", "advances"] });
      qc.invalidateQueries({ queryKey: ["payroll", "employees"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}

export function useRecoverAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/payroll/advances/${id}/recover`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll", "advances"] });
      qc.invalidateQueries({ queryKey: ["payroll", "employees"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export function useLoans(filters, enabled = true) {
  const safe = filters || {};
  return useQuery({
    queryKey: ["payroll", "loans", safe],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safe.employee_id) params.set("employee_id", String(safe.employee_id));
      if (safe.status) params.set("status", safe.status);
      const qs = params.toString();
      const data = await fetchJson(`/api/payroll/loans${qs ? `?${qs}` : ""}`);
      return data;
    },
    enabled,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/payroll/loans", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll", "loans"] });
      qc.invalidateQueries({ queryKey: ["payroll", "employees"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}

export function useLoanSchedule(loanId, enabled = true) {
  return useQuery({
    queryKey: ["payroll", "loans", loanId, "schedule"],
    queryFn: async () => fetchJson(`/api/payroll/loans/${loanId}/schedule`),
    enabled: enabled && !!loanId,
  });
}
