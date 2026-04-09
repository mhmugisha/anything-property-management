"use client";

import { useEffect } from "react";
import useUser from "@/utils/useUser";

export default function HomePage() {
  const { data: user, loading } = useUser();

  useEffect(() => {
    if (!loading) {
      if (user) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/account/signin";
      }
    }
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center">
      <p className="text-slate-600">Loading...</p>
    </div>
  );
}
