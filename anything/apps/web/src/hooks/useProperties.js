import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson, deleteJson } from "@/utils/api";

export function useProperties(
  search,
  enabled,
  { includeArchived = false } = {},
) {
  return useQuery({
    queryKey: ["properties", { search, includeArchived }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search.trim().length > 0) qs.set("search", search.trim());
      if (includeArchived) qs.set("archived", "1");
      const url = `/api/properties?${qs.toString()}`;
      const data = await fetchJson(url);
      return data.properties || [];
    },
    enabled,
  });
}

export function usePropertyDetail(propertyId, enabled) {
  return useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const data = await fetchJson(`/api/properties/${propertyId}`);
      return data.property;
    },
    enabled: !!propertyId && enabled,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => postJson("/api/properties", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/properties/${id}`, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({
        queryKey: ["property", variables.id],
      });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => deleteJson(`/api/properties/${id}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", id] });
    },
  });
}

export function decommissionSummaryKey(propertyId) {
  return ["property", propertyId, "decommission-summary"];
}

export function fetchDecommissionSummary(propertyId) {
  return fetchJson(`/api/properties/${propertyId}/decommission-summary`);
}

// Active leases that must be cleared before a property can be decommissioned.
export function useDecommissionSummary(propertyId, enabled) {
  return useQuery({
    queryKey: decommissionSummaryKey(propertyId),
    queryFn: () => fetchDecommissionSummary(propertyId),
    enabled: !!propertyId && enabled,
    staleTime: 0,
  });
}

export function useDecommissionProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) =>
      postJson(`/api/properties/${id}/decommission`, {}),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      // Prefix match also refreshes the decommission summary.
      queryClient.invalidateQueries({ queryKey: ["property", id] });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
    },
  });
}

export function useReactivateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => postJson(`/api/properties/${id}/reactivate`, {}),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", id] });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
    },
  });
}
