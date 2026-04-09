import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useTenantLookup(searchTerm, enabled) {
  return useQuery({
    queryKey: ["lookups", "tenants", searchTerm],
    queryFn: async () => {
      const qs = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const data = await fetchJson(`/api/lookups/tenants${qs}`);
      return data.tenants || [];
    },
    enabled,
  });
}
