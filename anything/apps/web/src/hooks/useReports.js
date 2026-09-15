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

export function useCountsSummaryReport(enabled) {
  return useQuery({
    queryKey: ["reports", "countsSummary"],
    queryFn: async () => {
      const data = await fetchJson("/api/reports/counts-summary");
      return data;
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

export function useManagerArrearsReport(filters, enabled) {
  const fromDate = (filters?.fromDate || "").trim();
  const toDate = (filters?.toDate || "").trim();
  const officerId = filters?.officerId || "";

  const qs = new URLSearchParams();
  if (fromDate) qs.set("fromDate", fromDate);
  if (toDate) qs.set("toDate", toDate);
  if (officerId) qs.set("officerId", String(officerId));

  const url = `/api/reports/manager-arrears${qs.toString() ? `?${qs.toString()}` : ""}`;

  return useQuery({
    queryKey: ["reports", "managerArrears", { fromDate, toDate, officerId }],
    queryFn: async () => {
      const data = await fetchJson(url);
      return data;
    },
    enabled,
  });
}

export function useManagerComparisonReport(filters, enabled) {
  const fromDate = (filters?.fromDate || "").trim();
  const toDate = (filters?.toDate || "").trim();

  const qs = new URLSearchParams();
  if (fromDate) qs.set("fromDate", fromDate);
  if (toDate) qs.set("toDate", toDate);

  const url = `/api/reports/manager-comparison${qs.toString() ? `?${qs.toString()}` : ""}`;

  return useQuery({
    queryKey: ["reports", "managerComparison", { fromDate, toDate }],
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
  const officerId = filters?.officerId || "";

  const qs = new URLSearchParams();
  if (month) qs.set("month", String(month));
  if (year) qs.set("year", String(year));
  if (landlordId) qs.set("landlordId", String(landlordId));
  if (propertyId) qs.set("propertyId", String(propertyId));
  if (officerId) qs.set("officerId", String(officerId));

  const url = `/api/reports/payment-status?${qs.toString()}`;

  return useQuery({
    queryKey: [
      "reports",
      "paymentStatus",
      { month, year, landlordId, propertyId, officerId },
    ],
    queryFn: async () => {
      const data = await fetchJson(url);
      return data;
    },
    enabled: enabled && !!month && !!year,
  });
}
