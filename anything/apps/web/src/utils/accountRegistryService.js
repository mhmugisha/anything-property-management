import { fetchJson } from "@/utils/api";

/**
 * AccountRegistryService
 *
 * Single responsibility: load the authoritative Chart of Accounts from the
 * existing accounting datasource (chart_of_accounts via /api/accounting/accounts).
 *
 * NOTE: This is intentionally thin and does not assume any schema beyond the
 * existing public API route.
 */
export const AccountRegistryService = {
  loadAll: async () => {
    const data = await fetchJson("/api/accounting/accounts");
    const accounts = data?.accounts;
    return Array.isArray(accounts) ? accounts : [];
  },
};
