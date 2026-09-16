import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson } from "@/utils/api";

export function usePromisesForTenant(tenantId, enabled = true) {
  return useQuery({
    queryKey: ["paymentPromises", "byTenant", tenantId],
    queryFn: async () => {
      const data = await fetchJson(
        `/api/payment-promises?tenant_id=${encodeURIComponent(String(tenantId))}`,
      );
      return data.promises || [];
    },
    enabled: enabled && !!tenantId,
  });
}

export function useLatestPromises(tenantIds, enabled = true) {
  const ids = Array.isArray(tenantIds)
    ? Array.from(new Set(tenantIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b)
    : [];

  return useQuery({
    queryKey: ["paymentPromises", "latest", ids],
    queryFn: async () => {
      if (ids.length === 0) return {};
      const data = await fetchJson(
        `/api/payment-promises/latest?tenant_ids=${ids.join(",")}`,
      );
      return data.latest_by_tenant || {};
    },
    enabled: enabled && ids.length > 0,
  });
}

export function useDuePromises(enabled = true) {
  return useQuery({
    queryKey: ["paymentPromises", "due"],
    queryFn: async () => {
      const data = await fetchJson("/api/payment-promises/due");
      return {
        count: Number(data?.count || 0),
        promises: data?.promises || [],
      };
    },
    enabled,
  });
}

export function useCreatePromise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/payment-promises", payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["paymentPromises"] });
      const tenantId = vars?.tenant_id;
      if (tenantId) {
        qc.invalidateQueries({
          queryKey: ["paymentPromises", "byTenant", tenantId],
        });
      }
    },
  });
}

export function useUpdatePromise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/payment-promises/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paymentPromises"] });
    },
  });
}
