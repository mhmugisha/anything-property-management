import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useStaffProfile(enabled) {
  return useQuery({
    // OPTIMIZATION: Use consistent query key (removed userId) to prevent duplicate fetches
    queryKey: ["staffProfile"],
    queryFn: async () => {
      const data = await fetchJson("/api/staff/profile");
      return data.staff;
    },
    enabled,
    // Cache staff profile for 5 minutes
    staleTime: 1000 * 60 * 5,
  });
}
