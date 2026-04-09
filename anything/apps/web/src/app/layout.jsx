"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // react-query v5 uses gcTime (cacheTime was removed)
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const ENTRY_PATHS = [
  "/dashboard",
  "/landlords",
  "/properties",
  "/tenants",
  "/payments",
  "/reports",
  "/accounting",
  "/maintenance",
];

export default function RootLayout({ children }) {
  const [pathname, setPathname] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      try {
        setPathname(window.location.pathname || "/");
      } catch {
        setPathname("/");
      }
    };

    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const isEntry = useMemo(() => {
    if (!pathname) return false;
    return ENTRY_PATHS.includes(pathname);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {/* Global page background (slightly darker) */}
      <style jsx global>{`
        html,
        body {
          background: #e2e8f0; /* tailwind slate-200 */
        }
      `}</style>
    </QueryClientProvider>
  );
}
