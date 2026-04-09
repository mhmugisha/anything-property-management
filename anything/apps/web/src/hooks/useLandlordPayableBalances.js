import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useLandlordPayableBalances(filters, enabled = true) {
  return useQuery({
    queryKey: ["reports", "landlordPayableBalances", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.month) params.set("month", String(filters.month));
      if (filters?.year) params.set("year", String(filters.year));
      if (filters?.landlordId)
        params.set("landlordId", String(filters.landlordId));
      if (filters?.propertyId)
        params.set("propertyId", String(filters.propertyId));

      const data = await fetchJson(
        `/api/reports/landlord-payable-balances?${params.toString()}`,
      );
      return data;
    },
    enabled,
  });
}
