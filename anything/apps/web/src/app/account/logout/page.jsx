"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useAuth from "@/utils/useAuth";
import ExelaLogo from "@/components/ExelaLogo";

export default function LogoutPage() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleSignOut = async () => {
      // Clear all cached data before signing out
      queryClient.clear();

      await signOut({
        callbackUrl: "/account/signin",
        redirect: true,
      });
    };
    handleSignOut();
  }, [signOut, queryClient]);

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center mb-4">
          <ExelaLogo variant="light" height="h-16" />
        </div>
        <p className="text-slate-600">Signing you out...</p>
      </div>
    </div>
  );
}
