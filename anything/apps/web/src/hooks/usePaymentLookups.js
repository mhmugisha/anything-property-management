import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useLandlordLookup(enabled) {
  return useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/landlords");
      return data.landlords || [];
    },
    enabled,
  });
}

// Modified to not require landlordId - fetch all properties
export function usePropertyLookup(enabled) {
  return useQuery({
    queryKey: ["lookups", "properties"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/properties");
      return data.properties || [];
    },
    enabled,
  });
}

// Modified to support fetching all tenants (propertyId is optional)
export function useTenantLookup(propertyId, enabled) {
  return useQuery({
    queryKey: ["lookups", "tenants", propertyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      const qs = params.toString();
      const url = qs ? `/api/lookups/tenants?${qs}` : "/api/lookups/tenants";
      const data = await fetchJson(url);
      return data.tenants || [];
    },
    enabled: enabled, // No longer requires propertyId
  });
}

export function useDueInvoices(tenantId, enabled) {
  return useQuery({
    queryKey: ["invoices", "due", tenantId],
    queryFn: async () => {
      const data = await fetchJson(`/api/invoices/due?tenantId=${tenantId}`);
      return data.invoices || [];
    },
    enabled: enabled && !!tenantId,
  });
}
