import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AccountRegistryService } from "@/utils/accountRegistryService";
import { useAccountRegistryStore } from "@/utils/accountRegistryStore";

/**
 * Bootstraps + exposes the in-memory Chart of Accounts registry.
 *
 * Flow:
 * AccountingModuleMount -> AccountRegistryService.loadAll() -> AccountRegistryStore.setAccounts()
 */
export function useAccountRegistry(enabled) {
  const storeAccounts = useAccountRegistryStore((s) => s.accounts);
  const storeHydrated = useAccountRegistryStore((s) => s.hydrated);
  const setAccounts = useAccountRegistryStore((s) => s.setAccounts);

  const query = useQuery({
    queryKey: ["accountRegistry", "accounts"],
    queryFn: AccountRegistryService.loadAll,
    enabled,
  });

  useEffect(() => {
    if (!query.data) return;
    setAccounts(query.data);
  }, [query.data, setAccounts]);

  const accounts = useMemo(() => {
    if (Array.isArray(storeAccounts)) return storeAccounts;
    if (Array.isArray(query.data)) return query.data;
    return null;
  }, [storeAccounts, query.data]);

  const hydrated = useMemo(() => {
    return storeHydrated || Array.isArray(accounts);
  }, [storeHydrated, accounts]);

  const isHydrating = useMemo(() => {
    if (!enabled) return false;
    if (hydrated) return false;
    return query.isLoading;
  }, [enabled, hydrated, query.isLoading]);

  return {
    accounts,
    hydrated,
    isHydrating,
    query,
  };
}
