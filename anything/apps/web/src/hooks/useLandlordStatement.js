import { useState } from "react";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Local-date YYYY-MM-DD; toISOString() would shift to UTC (e.g. 09-30 in EAT).
function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function useLandlordStatement() {
  const [statementPropertyId, setStatementPropertyId] = useState("");
  const [from, setFrom] = useState(() => {
    const now = new Date();
    return ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [to, setTo] = useState(() => {
    const now = new Date();
    return ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
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
