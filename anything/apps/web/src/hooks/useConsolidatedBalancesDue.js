import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useConsolidatedBalancesDue(filters, enabled) {
  const safe = filters || {};
  return useQuery({
    queryKey: [
      "reports",
      "consolidatedBalancesDue",
      safe.landlordId,
      safe.from,
      safe.to,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (safe.landlordId) params.set("landlordId", String(safe.landlordId));
      if (safe.from) params.set("from", safe.from);
      if (safe.to) params.set("to", safe.to);
      const data = await fetchJson(
        `/api/reports/consolidated-balances-due?${params.toString()}`,
      );
      return data;
    },
    enabled: enabled, // Always enabled when permission check passes
  });
}
