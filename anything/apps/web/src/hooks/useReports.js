import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function useArrearsReport(enabled) {
  return useQuery({
    queryKey: ["reports", "arrears"],
    queryFn: async () => {
      const data = await fetchJson("/api/reports/arrears");
      return data.rows || [];
    },
    enabled,
  });
}

export function useTenantStatement(tenantId, enabled) {
  return useQuery({
    queryKey: ["reports", "tenantStatement", tenantId],
    queryFn: async () => {
      const data = await fetchJson(
        `/api/reports/tenant-statement?tenantId=${tenantId}`,
      );
      return data;
    },
    enabled: enabled && !!tenantId,
  });
}

export function useLandlordPayoutsSummary(filters, enabled) {
  const from = (filters?.from || "").trim();
  const to = (filters?.to || "").trim();

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const url = `/api/reports/landlord-payouts${qs.toString() ? `?${qs.toString()}` : ""}`;

  return useQuery({
    queryKey: ["reports", "landlordPayouts", { from, to }],
    queryFn: async () => {
      const data = await fetchJson(url);
      return data;
    },
    enabled,
  });
}

export function usePaymentStatusReport(filters, enabled) {
  const month = filters?.month;
  const year = filters?.year;
  const landlordId = filters?.landlordId || "";
  const propertyId = filters?.propertyId || "";

  const qs = new URLSearchParams();
  if (month) qs.set("month", String(month));
  if (year) qs.set("year", String(year));
  if (landlordId) qs.set("landlordId", String(landlordId));
  if (propertyId) qs.set("propertyId", String(propertyId));

  const url = `/api/reports/payment-status?${qs.toString()}`;

  return useQuery({
    queryKey: [
      "reports",
      "paymentStatus",
      { month, year, landlordId, propertyId },
    ],
    queryFn: async () => {
      const data = await fetchJson(url);
      return data;
    },
    enabled: enabled && !!month && !!year,
  });
}
