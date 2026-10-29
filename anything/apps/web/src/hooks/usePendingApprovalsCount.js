import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

// Keyed under ["approvals", ...] so approving/rejecting on the approvals page
// (which invalidates ["approvals"]) refreshes the badge immediately.
export function usePendingApprovalsCount(isAdmin, enabled) {
  const query = useQuery({
    queryKey: ["approvals", "count"],
    queryFn: async () => {
      const data = await fetchJson("/api/approvals/count");
      return Number(data?.total || 0);
    },
    enabled: !!isAdmin && !!enabled,
    refetchInterval: 30000,
    staleTime: 20000,
  });

  return query.data || 0;
}
