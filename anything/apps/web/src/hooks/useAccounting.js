import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson } from "@/utils/api";

export function useAccounts(enabled) {
  return useQuery({
    queryKey: ["accounting", "accounts"],
    queryFn: async () => {
      const data = await fetchJson("/api/accounting/accounts");
      return data.accounts || [];
    },
    enabled,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/accounts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      // keep the in-memory Account Registry in sync (non-breaking: extra cache key)
      queryClient.invalidateQueries({
        queryKey: ["accountRegistry", "accounts"],
      });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/accounting/accounts/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      // keep the in-memory Account Registry in sync (non-breaking: extra cache key)
      queryClient.invalidateQueries({
        queryKey: ["accountRegistry", "accounts"],
      });
    },
  });
}

export function useJournal(filters, enabled) {
  const safeFilters = filters || {};
  return useQuery({
    queryKey: ["accounting", "journal", safeFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safeFilters.from) params.set("from", safeFilters.from);
      if (safeFilters.to) params.set("to", safeFilters.to);
      const qs = params.toString();
      const url = qs
        ? `/api/accounting/transactions?${qs}`
        : "/api/accounting/transactions";
      const data = await fetchJson(url);
      return data.transactions || [];
    },
    enabled,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/transactions", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "trialBalance"],
      });
      queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
    },
  });
}

export function useCreateLandlordDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/landlord-deductions", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useCreateTenantDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/tenant-deductions", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateArrears() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/post-arrears", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useCreateManualInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/post-manual-invoice", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "journal"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "pl"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "balanceSheet"],
      });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useTrialBalance(filters, enabled) {
  const safeFilters = filters || {};
  return useQuery({
    queryKey: ["accounting", "trialBalance", safeFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safeFilters.from) params.set("from", safeFilters.from);
      if (safeFilters.to) params.set("to", safeFilters.to);
      const qs = params.toString();
      const url = qs
        ? `/api/accounting/trial-balance?${qs}`
        : "/api/accounting/trial-balance";
      const data = await fetchJson(url);
      return data;
    },
    enabled,
  });
}

export function useProfitLoss(filters, enabled) {
  const safeFilters = filters || {};
  return useQuery({
    queryKey: ["accounting", "pl", safeFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safeFilters.from) params.set("from", safeFilters.from);
      if (safeFilters.to) params.set("to", safeFilters.to);
      const qs = params.toString();
      const url = qs ? `/api/accounting/pl?${qs}` : "/api/accounting/pl";
      const data = await fetchJson(url);
      return data;
    },
    enabled,
  });
}

export function useBalanceSheet(filters, enabled) {
  const safeFilters = filters || {};
  return useQuery({
    queryKey: ["accounting", "balanceSheet", safeFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safeFilters.to) params.set("to", safeFilters.to);
      const qs = params.toString();
      const url = qs
        ? `/api/accounting/balance-sheet?${qs}`
        : "/api/accounting/balance-sheet";
      const data = await fetchJson(url);
      return data;
    },
    enabled,
  });
}

export function useSeedAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/seed-accounts", payload || {}),
    onSuccess: () => {
      // Refresh both the legacy accounts query and the authoritative registry query.
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      queryClient.invalidateQueries({
        queryKey: ["accountRegistry", "accounts"],
      });
    },
  });
}
