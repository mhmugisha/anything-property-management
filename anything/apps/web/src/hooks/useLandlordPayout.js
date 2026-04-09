import { useState, useCallback } from "react";

export function useLandlordPayout() {
  const [payoutDate, setPayoutDate] = useState(() => {
    const iso = new Date().toISOString().slice(0, 10);
    return iso;
  });
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Bank Account - Operating");
  const [payoutRef, setPayoutRef] = useState("");

  const resetPayout = useCallback(() => {
    setPayoutAmount("");
    setPayoutRef("");
  }, []);

  return {
    payoutDate,
    payoutAmount,
    payoutMethod,
    payoutRef,
    setPayoutDate,
    setPayoutAmount,
    setPayoutMethod,
    setPayoutRef,
    resetPayout,
  };
}
