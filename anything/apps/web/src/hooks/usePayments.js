import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@/utils/api";

export function usePayments(filters, enabled) {
  const safeFilters = filters || {};
  return useQuery({
    queryKey: ["payments", safeFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safeFilters.search) params.set("search", safeFilters.search);
      if (safeFilters.propertyId)
        params.set("propertyId", String(safeFilters.propertyId));
      if (safeFilters.tenantId)
        params.set("tenantId", String(safeFilters.tenantId));
      if (safeFilters.from) params.set("from", safeFilters.from);
      if (safeFilters.to) params.set("to", safeFilters.to);

      const qs = params.toString();
      const url = qs ? `/api/payments?${qs}` : "/api/payments";
      const data = await fetchJson(url);
      return data.payments || [];
    },
    enabled,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/payments", payload),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] }); // Always invalidate reports for all payments
      const invoiceId = vars?.invoice_id;
      if (invoiceId) {
        queryClient.invalidateQueries({ queryKey: ["invoices", "due"] });
        queryClient.invalidateQueries({ queryKey: ["accounting"] });
      }
    },
  });
}
