import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function usePendingApprovalsCount(isAdmin, enabled) {
  const query = useQuery({
    queryKey: ["pendingApprovalsCount"],
    queryFn: async () => {
      const data = await fetchJson("/api/approvals");
      const total =
        (data.payments?.length || 0) +
        (data.invoices?.length || 0) +
        (data.transactions?.length || 0) +
        (data.tenantDeductions?.length || 0) +
        (data.landlordDeductions?.length || 0) +
        (data.landlords?.length || 0) +
        (data.properties?.length || 0) +
        (data.tenants?.length || 0);
      return total;
    },
    enabled: !!isAdmin && !!enabled,
    refetchInterval: 30000,
    staleTime: 20000,
  });

  return query.data || 0;
}
