import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useDashboardStats(enabled) {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const data = await fetchJson("/api/dashboard/stats");
      return data;
    },
    enabled,
    // OPTIMIZATION: Cache for 5 minutes to prevent unnecessary refetches
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (renamed from cacheTime in newer React Query)
  });
}
