"use client";

import { LogOut, Settings } from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import { PendingApprovalsLink } from "@/components/Shell/PendingApprovalsLink";

export default function Sidebar({ active, children }) {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const isAdmin = staffQuery.data?.role_name === "Admin";

  return (
    <aside className="hidden md:flex fixed top-32 left-0 flex-col w-[270px] h-[calc(100vh-8rem)] bg-[#0E1D33] border-r border-white/10 overflow-x-hidden">
      {/* Dynamic content area */}
      <div className="flex-1 px-3 pt-4 overflow-y-auto overflow-x-hidden">{children}</div>

      {/* Bottom section: Pending Approvals + Settings + Sign Out */}
      <div className="px-3 pb-4 space-y-2">
        <PendingApprovalsLink isAdmin={isAdmin} enabled={!userLoading && !!user} />
        {isAdmin ? (
          <a
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
            title="Settings"
          >
            <span className="w-10 flex items-center justify-center">
              <Settings className="w-7 h-5" />
            </span>
            <span className="text-base font-medium">Settings</span>
          </a>
        ) : null}

        <a
          href="/account/logout"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-rose-200 hover:bg-rose-500/20 transition-colors"
          title="Sign Out"
        >
          <span className="w-10 flex items-center justify-center">
            <LogOut className="w-7 h-5" />
          </span>
          <span className="text-base font-medium">Sign Out</span>
        </a>
      </div>
    </aside>
  );
}
