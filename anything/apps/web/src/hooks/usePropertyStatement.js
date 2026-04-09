import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function usePropertyStatement(propertyId, enabled) {
  return useQuery({
    queryKey: ["reports", "propertyStatement", propertyId],
    queryFn: async () => {
      const data = await fetchJson(
        `/api/reports/property-statement?propertyId=${encodeURIComponent(propertyId)}`,
      );
      return data;
    },
    enabled: enabled && !!propertyId,
  });
}
