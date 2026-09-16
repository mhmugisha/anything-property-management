"use client";

import { useEffect } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";

export default function HomePage() {
  const { data: user, loading } = useUser();
  const staffQuery = useStaffProfile(!loading && !!user);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = "/account/signin";
      return;
    }
    if (staffQuery.isLoading) return;
    if (staffQuery.data?.role_name === "Portfolio Manager") {
      window.location.href = "/reports?report=manager-arrears";
      return;
    }
    window.location.href = "/dashboard";
  }, [user, loading, staffQuery.isLoading, staffQuery.data?.role_name]);

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center">
      <p className="text-slate-600">Loading...</p>
    </div>
  );
}
