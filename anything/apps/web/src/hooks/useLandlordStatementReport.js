import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useLandlordStatementReport(landlordId, enabled) {
  return useQuery({
    queryKey: ["reports", "landlordStatement", landlordId],
    queryFn: async () => {
      const safeId = encodeURIComponent(String(landlordId));
      const data = await fetchJson(
        `/api/reports/landlord-statement?landlordId=${safeId}`,
      );
      return data;
    },
    enabled: enabled && !!landlordId,
  });
}
