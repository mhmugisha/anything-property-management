import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, putJson, deleteJson } from "@/utils/api";

export function buildTenantsQueryKey({
  search,
  landlordId,
  propertyId,
  includeArchived,
}) {
  return [
    "tenants",
    {
      search: search || "",
      landlordId: landlordId || null,
      propertyId: propertyId || null,
      includeArchived: includeArchived === true,
    },
  ];
}

export async function fetchTenants({
  search,
  landlordId,
  propertyId,
  includeArchived,
}) {
  const parts = [];
  if (search) parts.push(`search=${encodeURIComponent(search)}`);
  if (landlordId)
    parts.push(`landlordId=${encodeURIComponent(String(landlordId))}`);
  if (propertyId)
    parts.push(`propertyId=${encodeURIComponent(String(propertyId))}`);
  if (includeArchived) parts.push(`includeArchived=1`);
  const qs = parts.length ? `?${parts.join("&")}` : "";

  const data = await fetchJson(`/api/tenants${qs}`);
  return data.tenants || [];
}

export function useTenants(
  search,
  { landlordId, propertyId },
  { enabled, includeArchived },
) {
  const queryKey = buildTenantsQueryKey({
    search,
    landlordId,
    propertyId,
    includeArchived,
  });

  return useQuery({
    queryKey,
    queryFn: async () => {
      return fetchTenants({ search, landlordId, propertyId, includeArchived });
    },
    enabled,
    // Keep the previous list visible while a new property loads.
    // This makes switching properties feel instant.
    placeholderData: (prev) => prev,
  });
}

export function useTenantDetail(id, enabled) {
  return useQuery({
    queryKey: ["tenants", "detail", id],
    queryFn: async () => {
      const data = await fetchJson(`/api/tenants/${id}`);
      return data.tenant;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/tenants", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/tenants/${id}`, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", "detail", vars.id],
      });
    },
  });
}

export function useTenantLeases(tenantId, enabled) {
  return useQuery({
    queryKey: ["tenants", tenantId, "leases"],
    queryFn: async () => {
      const data = await fetchJson(`/api/tenants/${tenantId}/leases`);
      return data.leases || [];
    },
    enabled: enabled && !!tenantId,
  });
}

export function useVacantUnits({ includeUnitId }, enabled) {
  return useQuery({
    queryKey: ["units", "vacant", { includeUnitId: includeUnitId || null }],
    queryFn: async () => {
      const qs = includeUnitId
        ? `?includeUnitId=${encodeURIComponent(String(includeUnitId))}`
        : "";
      const data = await fetchJson(`/api/units/vacant${qs}`);
      return data.units || [];
    },
    enabled,
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => postJson("/api/leases", payload),
    onSuccess: (data, vars) => {
      const tenantId = vars?.tenant_id;
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenants", tenantId, "leases"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
    },
  });
}

export function useCreateTenantWithLease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) =>
      postJson("/api/tenants/create-with-lease", payload),
    onSuccess: (data) => {
      const tenantId = data?.tenant?.id;
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });

      // IMPORTANT: creating a tenant/lease also creates invoices.
      // Invalidate invoice- and dashboard-related queries so the UI updates without a hard refresh.
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenants", "detail", tenantId],
        });
        queryClient.invalidateQueries({
          queryKey: ["tenants", tenantId, "leases"],
        });
      }
    },
  });
}

export function useUpdateLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) =>
      putJson(`/api/leases/${id}`, payload),
    onSuccess: (data, vars) => {
      const lease = data?.lease;
      const tenantId = lease?.tenant_id;
      if (tenantId) {
        queryClient.invalidateQueries({
          queryKey: ["tenants", tenantId, "leases"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useEndTenantLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId) =>
      postJson(`/api/tenants/${tenantId}/end-lease`, {}),
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", "detail", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "leases"],
      });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useArchiveTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId) =>
      postJson(`/api/tenants/${tenantId}/archive`, {}),
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", "detail", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "leases"],
      });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReactivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId) =>
      postJson(`/api/tenants/${tenantId}/reactivate`, {}),
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", "detail", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "leases"],
      });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useOpenTenantLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId) =>
      postJson(`/api/tenants/${tenantId}/open-lease`, {}),
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", "detail", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", tenantId, "leases"],
      });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId) => deleteJson(`/api/tenants/${tenantId}`),
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["units", "vacant"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.removeQueries({ queryKey: ["tenants", "detail", tenantId] });
      queryClient.removeQueries({ queryKey: ["tenants", tenantId, "leases"] });
    },
  });
}
