import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useLandlordSummary(month, year, enabled) {
  return useQuery({
    queryKey: ["reports", "landlordSummary", month, year],
    queryFn: async () => {
      const data = await fetchJson(
        `/api/reports/landlord-summary?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`,
      );
      return data;
    },
    enabled,
  });
}
