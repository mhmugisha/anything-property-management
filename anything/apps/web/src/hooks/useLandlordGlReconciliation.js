import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

// GL 2100 vs source (due to landlords) per landlord. Read-only, admin-only.
export function useLandlordGlReconciliation(enabled) {
  return useQuery({
    queryKey: ["reports", "landlordGlReconciliation"],
    queryFn: () => fetchJson("/api/reports/landlord-gl-reconciliation"),
    enabled,
  });
}
