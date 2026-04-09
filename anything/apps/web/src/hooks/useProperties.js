import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson } from "@/utils/api";

export function useProperties(search, enabled) {
  return useQuery({
    queryKey: ["properties", { search }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search.trim().length > 0) qs.set("search", search.trim());
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
