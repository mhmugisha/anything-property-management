import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson, deleteJson } from "@/utils/api";

export function useLandlords(filters, enabled) {
  const safe = filters || {};
  return useQuery({
    queryKey: ["landlords", safe],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safe.search) params.set("search", safe.search);
      if (safe.includeArchived) params.set("includeArchived", "1");
      const qs = params.toString();
      const url = qs ? `/api/landlords?${qs}` : "/api/landlords";
      const data = await fetchJson(url);
      return data.landlords || [];
    },
    enabled,
  });
}

export function useCreateLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/landlords", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["lookups", "landlords"] });
    },
  });
}

export function useUpdateLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/landlords/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["landlord", String(vars?.id)] });
      qc.invalidateQueries({ queryKey: ["lookups", "landlords"] });
    },
  });
}

export function useLandlordDetail(id, enabled) {
  return useQuery({
    queryKey: ["landlord", String(id)],
    queryFn: async () => {
      const data = await fetchJson(`/api/landlords/${id}`);
      return data.landlord || null;
    },
    enabled,
  });
}

export function useLandlordProperties(landlordId, enabled) {
  return useQuery({
    queryKey: ["landlords", String(landlordId), "properties"],
    queryFn: async () => {
      const data = await fetchJson(`/api/landlords/${landlordId}/properties`);
      return data.properties || [];
    },
    enabled,
  });
}

export function useLandlordPropertyStatement(filters, enabled) {
  const safe = filters || {};
  return useQuery({
    queryKey: [
      "reports",
      "landlordPropertyStatement",
      safe.landlordId,
      safe.propertyId,
      safe.from,
      safe.to,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("landlordId", String(safe.landlordId));
      params.set("propertyId", String(safe.propertyId));
      if (safe.from) params.set("from", safe.from);
      if (safe.to) params.set("to", safe.to);
      const data = await fetchJson(
        `/api/reports/landlord-property-statement?${params.toString()}`,
      );
      return data;
    },
    enabled,
  });
}

export function useCreateLandlordPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/landlords/payouts", payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["reports", "landlordPropertyStatement"],
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
      const landlordId = vars?.landlord_id;
      if (landlordId) {
        qc.invalidateQueries({
          queryKey: ["landlords", String(landlordId), "properties"],
        });
      }
    },
  });
}

export function useArchiveLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => postJson(`/api/landlords/${id}/archive`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["landlord", String(id)] });
      qc.invalidateQueries({ queryKey: ["lookups", "landlords"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReactivateLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => postJson(`/api/landlords/${id}/reactivate`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["landlord", String(id)] });
      qc.invalidateQueries({ queryKey: ["lookups", "landlords"] });
    },
  });
}

export function useEndLandlordLeases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => postJson(`/api/landlords/${id}/end-leases`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useEndLandlordContractNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) =>
      postJson(`/api/landlords/${id}/end-contract-now`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["landlord", String(id)] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["lookups", "landlords"] });
    },
  });
}

export function useDeleteLandlord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => deleteJson(`/api/landlords/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["lookups", "landlords"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
