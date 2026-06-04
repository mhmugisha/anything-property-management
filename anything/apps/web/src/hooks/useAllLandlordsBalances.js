import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useAllLandlordsBalances(filters, enabled) {
  const safe = filters || {};
  return useQuery({
    queryKey: [
      "reports",
      "allLandlordsBalances",
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
        `/api/reports/all-landlords-balances?${params.toString()}`,
      );
      return data;
    },
    enabled: enabled && !!safe.from && !!safe.to,
  });
}
