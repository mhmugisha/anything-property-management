"use client";

import { ShieldAlert } from "lucide-react";
import useUser from "@/utils/useUser";
import ExelaLogo from "@/components/ExelaLogo";

// Shown to a signed-in user who has no staff profile. Staff accounts are
// created only by an admin (Settings → Users), so there is nothing to do
// here except contact an administrator or sign out.
export default function NoAccessPage() {
  const { data: user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center mb-6">
          <ExelaLogo variant="light" height="h-16" />
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 mb-4">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-2">
            No access
          </h1>
          <p className="text-slate-600">
            {user.email ? (
              <>
                <span className="font-medium">{user.email}</span> is not set
                up as a staff account.
              </>
            ) : (
              "This account is not set up as a staff account."
            )}{" "}
            Please contact your administrator.
          </p>
          <a
            href="/account/logout"
            className="mt-6 inline-block w-full bg-[#0B1F3A] text-white py-3 rounded-lg font-medium hover:bg-[#08172c] transition-colors"
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
