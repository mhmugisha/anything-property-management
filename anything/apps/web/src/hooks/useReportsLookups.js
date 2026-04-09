import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useReportsLookups(enabled) {
  const tenantLookupQuery = useQuery({
    queryKey: ["lookups", "tenants"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/tenants");
      return data.tenants || [];
    },
    enabled,
  });

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

  return {
    tenantLookupQuery,
    landlordLookupQuery,
    propertyLookupQuery,
  };
}
