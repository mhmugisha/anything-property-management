import { useState } from "react";

export function useLandlordStatement() {
  const [statementPropertyId, setStatementPropertyId] = useState("");
  const [from, setFrom] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return end.toISOString().slice(0, 10);
  });

  return {
    statementPropertyId,
    setStatementPropertyId,
    from,
    setFrom,
    to,
    setTo,
  };
}
