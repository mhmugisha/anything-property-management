import { create } from "zustand";

/**
 * Account Registry Store
 *
 * Holds the authoritative Chart of Accounts in runtime memory so:
 * - UI can subscribe to it
 * - other accounting UI pieces reuse the same hydrated registry
 *
 * NOTE: This store does not write to the database.
 */
export const useAccountRegistryStore = create((set) => ({
  accounts: null, // null until hydrated
  hydrated: false,
  hydratedAt: null,

  setAccounts: (accounts) => {
    const next = Array.isArray(accounts) ? accounts : [];
    set({
      accounts: next,
      hydrated: true,
      hydratedAt: new Date().toISOString(),
    });
  },

  clear: () => set({ accounts: null, hydrated: false, hydratedAt: null }),
}));
