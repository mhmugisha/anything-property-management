"use client";

import {
  Home,
  Building,
  Users,
  DollarSign,
  Wrench,
  FileText,
  Calculator,
  LogOut,
  X,
  User,
  Settings,
} from "lucide-react";

import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import ExelaLogo from "@/components/ExelaLogo";

function MobileLink({ href, active, icon, label }) {
  const base = "flex items-center px-4 py-3 rounded-lg transition-colors";

  const classes = active
    ? `${base} text-white bg-white/15`
    : `${base} text-slate-200 hover:bg-white/10 hover:text-white`;

  return (
    <a href={href} className={classes}>
      <span className="w-5 h-5 mr-3">{icon}</span>
      {label}
    </a>
  );
}

export default function MobileMenu({ isOpen, onClose, active }) {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const isAdmin = staffQuery.data?.role_name === "Admin";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-20 md:hidden">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed top-0 left-0 w-72 h-full bg-[#0B1F3A] shadow-lg">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <ExelaLogo variant="dark" height="h-12" />
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-slate-200" />
          </button>
        </div>
        <nav className="px-4 py-3 space-y-2">
          <MobileLink
            href="/dashboard"
            active={active === "dashboard"}
            icon={<Home className="w-5 h-5" />}
            label="Dashboard"
          />
          <MobileLink
            href="/landlords"
            active={active === "landlords"}
            icon={<User className="w-5 h-5" />}
            label="Landlords"
          />
          <MobileLink
            href="/properties"
            active={active === "properties"}
            icon={<Building className="w-5 h-5" />}
            label="Properties"
          />
          <MobileLink
            href="/tenants"
            active={active === "tenants"}
            icon={<Users className="w-5 h-5" />}
            label="Tenants"
          />
          <MobileLink
            href="/payments"
            active={active === "payments"}
            icon={<DollarSign className="w-5 h-5" />}
            label="Payments"
          />
          <MobileLink
            href="/reports"
            active={active === "reports"}
            icon={<FileText className="w-5 h-5" />}
            label="Reports"
          />
          <MobileLink
            href="/accounting"
            active={active === "accounting"}
            icon={<Calculator className="w-5 h-5" />}
            label="Accounting"
          />
          <MobileLink
            href="/maintenance"
            active={active === "maintenance"}
            icon={<Wrench className="w-5 h-5" />}
            label="Maintenance"
          />

          {isAdmin ? (
            <MobileLink
              href="/settings"
              active={active === "settings"}
              icon={<Settings className="w-5 h-5" />}
              label="Settings"
            />
          ) : null}

          <a
            href="/account/logout"
            className="flex items-center px-4 py-3 text-rose-200 hover:bg-rose-500/20 rounded-lg mt-4 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </a>
        </nav>
      </div>
    </div>
  );
}
