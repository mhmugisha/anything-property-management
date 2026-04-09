import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson } from "@/utils/api";

export function useUnits(propertyId, enabled) {
  return useQuery({
    queryKey: ["units", propertyId],
    queryFn: async () => {
      const data = await fetchJson(`/api/properties/${propertyId}/units`);
      return data.units || [];
    },
    enabled: !!propertyId && enabled,
  });
}

export function useCreateUnit(propertyId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) =>
      postJson(`/api/properties/${propertyId}/units`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["units", propertyId],
      });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useUpdateUnit(propertyId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ unitId, payload }) =>
      putJson(`/api/units/${unitId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["units", propertyId],
      });
    },
  });
}

export function useDeleteUnit(propertyId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (unitId) => {
      const response = await fetch(`/api/units/${unitId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete unit");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["units", propertyId],
      });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}
