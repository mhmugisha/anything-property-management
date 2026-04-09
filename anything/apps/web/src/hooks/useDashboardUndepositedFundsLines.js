import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useDashboardUndepositedFundsLines(enabled) {
  return useQuery({
    queryKey: ["dashboard", "undepositedFundsLines"],
    queryFn: async () => {
      const data = await fetchJson("/api/dashboard/undeposited-funds");
      return data.lines || [];
    },
    enabled,
    // This data is only used when the modal opens; no need to be super fresh.
    staleTime: 1000 * 60, // 1 minute
  });
}
