import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@/utils/api";

export function useLandlordReconciliation(landlordId, month, year, enabled) {
  return useQuery({
    queryKey: ["reconciliation", "landlord", landlordId, month, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", String(month));
      if (year) params.set("year", String(year));
      const qs = params.toString();
      return fetchJson(`/api/landlords/${landlordId}/reconciliation${qs ? `?${qs}` : ""}`);
    },
    enabled: !!landlordId && enabled === true,
  });
}

export function useApplyReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ landlordId, payload }) =>
      postJson(`/api/landlords/${landlordId}/reconcile`, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["reconciliation", "landlord", variables.landlordId],
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliation", "report"] });
    },
  });
}

export function useCreditLandlord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/accounting/credit-landlord", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });
}

export function useReconciliationReport(month, year, enabled) {
  return useQuery({
    queryKey: ["reconciliation", "report", month, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", String(month));
      if (year) params.set("year", String(year));
      const qs = params.toString();
      return fetchJson(`/api/reports/reconciliation${qs ? `?${qs}` : ""}`);
    },
    enabled: enabled === true,
  });
}
