import { useState, useEffect, useMemo } from "react";

export function usePaymentFilters() {
  const [search, setSearch] = useState("");

  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().slice(0, 10);
  }, [now]);
  const defaultTo = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qFrom = sp.get("from");
    const qTo = sp.get("to");
    if (qFrom) setFrom(qFrom);
    if (qTo) setTo(qTo);
  }, []);

  return {
    search,
    setSearch,
    from,
    setFrom,
    to,
    setTo,
    defaultFrom,
    defaultTo,
  };
}
