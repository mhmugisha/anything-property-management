import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson } from "@/utils/api";

export function useMaintenance(enabled) {
  return useQuery({
    queryKey: ["maintenance"],
    queryFn: async () => {
      const data = await fetchJson("/api/maintenance");
      return data.requests || [];
    },
    enabled,
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/maintenance", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/maintenance/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}

export function useApproveMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => postJson(`/api/maintenance/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}
