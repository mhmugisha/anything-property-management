import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useAccountingLookups(enabled, options) {
  const safeOptions = options || {};
  const landlordId = safeOptions.tenantLandlordId || "";
  const propertyId = safeOptions.tenantPropertyId || "";

  const landlordLookupQuery = useQuery({
    queryKey: ["lookups", "landlords"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/landlords");
      return data.landlords || [];
    },
    enabled,
  });

  const propertyLookupQuery = useQuery({
    queryKey: ["lookups", "properties"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/properties");
      return data.properties || [];
    },
    enabled,
  });

  const tenantLookupQuery = useQuery({
    queryKey: ["lookups", "tenants", { landlordId, propertyId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (landlordId) params.set("landlordId", landlordId);
      if (propertyId) params.set("propertyId", propertyId);
      const qs = params.toString();
      const url = qs ? `/api/lookups/tenants?${qs}` : "/api/lookups/tenants";
      const data = await fetchJson(url);
      return data.tenants || [];
    },
    enabled,
  });

  return {
    landlords: landlordLookupQuery.data || [],
    properties: propertyLookupQuery.data || [],
    tenants: tenantLookupQuery.data || [],
    landlordLookupQuery,
    propertyLookupQuery,
    tenantLookupQuery,
  };
}
