import { useState, useMemo, useEffect } from "react";

export function useAccountingState() {
  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, [now]);
  const defaultTo = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [tab, setTab] = useState("accounts");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const sp = new URLSearchParams(window.location.search);
      const qTab = (sp.get("tab") || "").trim();
      const qFrom = (sp.get("from") || "").trim();
      const qTo = (sp.get("to") || "").trim();

      const allowedTabs = new Set(["accounts", "journal", "statements"]);
      if (qTab && allowedTabs.has(qTab)) {
        setTab(qTab);
      }
      if (qFrom) setFrom(qFrom);
      if (qTo) setTo(qTo);
    } catch {
      // ignore
    }
  }, []);

  // Account form state
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");

  // Standard journal entry state
  const [txDate, setTxDate] = useState(defaultTo);
  const [txDescription, setTxDescription] = useState("");
  const [txRef, setTxRef] = useState("");
  const [txDebit, setTxDebit] = useState("");
  const [txCredit, setTxCredit] = useState("");
  const [txAmount, setTxAmount] = useState("");

  // Landlord deduction form state
  const [ldLandlordId, setLdLandlordId] = useState("");
  const [ldPropertyId, setLdPropertyId] = useState("");
  const [ldDate, setLdDate] = useState(defaultTo);
  const [ldDescription, setLdDescription] = useState("");
  const [ldAmount, setLdAmount] = useState("");
  const [ldSource, setLdSource] = useState("bank");

  // Tenant deduction form state
  const [tdLandlordId, setTdLandlordId] = useState("");
  const [tdTenantId, setTdTenantId] = useState("");
  const [tdPropertyId, setTdPropertyId] = useState("");
  const [tdDate, setTdDate] = useState(defaultTo);
  const [tdDescription, setTdDescription] = useState("");
  const [tdAmount, setTdAmount] = useState("");
  const [tdSource, setTdSource] = useState("bank");

  return {
    from,
    to,
    tab,
    setFrom,
    setTo,
    setTab,
    accountCode,
    accountName,
    accountType,
    setAccountCode,
    setAccountName,
    setAccountType,
    txDate,
    txDescription,
    txRef,
    txDebit,
    txCredit,
    txAmount,
    setTxDate,
    setTxDescription,
    setTxRef,
    setTxDebit,
    setTxCredit,
    setTxAmount,
    ldLandlordId,
    ldPropertyId,
    ldDate,
    ldDescription,
    ldAmount,
    ldSource,
    setLdLandlordId,
    setLdPropertyId,
    setLdDate,
    setLdDescription,
    setLdAmount,
    setLdSource,
    tdLandlordId,
    tdTenantId,
    tdPropertyId,
    tdDate,
    tdDescription,
    tdAmount,
    tdSource,
    setTdLandlordId,
    setTdTenantId,
    setTdPropertyId,
    setTdDate,
    setTdDescription,
    setTdAmount,
    setTdSource,
  };
}
