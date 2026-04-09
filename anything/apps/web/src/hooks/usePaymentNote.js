import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";

export function buildPaymentNoteQueryKey({ landlordId, propertyId, from, to }) {
  return [
    "reports",
    "payment-note",
    {
      landlordId: landlordId || null,
      propertyId: propertyId || null,
      from: from || null,
      to: to || null,
    },
  ];
}

export function usePaymentNote({ landlordId, propertyId, from, to }, enabled) {
  const queryKey = buildPaymentNoteQueryKey({
    landlordId,
    propertyId,
    from,
    to,
  });

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("landlordId", String(landlordId));
      params.set("propertyId", String(propertyId));
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `/api/reports/payment-note?${params.toString()}`;
      return fetchJson(url);
    },
    enabled,
    placeholderData: (prev) => prev,
  });
}
