import { Building, Menu } from "lucide-react";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import useUser from "@/utils/useUser";
import { useState, useEffect, useRef } from "react";
import NotificationBell from "./NotificationBell";
import ExelaLogo from "@/components/ExelaLogo";

export default function AppHeader({ title, onMenuToggle, active }) {
  const { data: user } = useUser();
  const staffProfileQuery = useStaffProfile(!!user, user?.id);
  const staffProfile = staffProfileQuery.data;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Generate initials from name for fallback avatar
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "landlords", label: "Landlords", href: "/landlords" },
    { key: "properties", label: "Properties", href: "/properties" },
    { key: "tenants", label: "Tenants", href: "/tenants" },
    { key: "payments", label: "Payments", href: "/payments" },
    { key: "reports", label: "Reports", href: "/reports" },
    { key: "accounting", label: "Accounting", href: "/accounting" },
    { key: "maintenance", label: "Maintenance", href: "/maintenance" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-20 bg-[#0E1D33] border-b border-white/10 h-32">
      <div className="h-full flex items-center px-4 md:px-6">
        <div className="max-w-[90%] mx-auto flex items-center justify-between flex-1">
          {/* Left: mobile menu + app logo */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-full hover:bg-white/10"
              onClick={onMenuToggle}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 stroke-2 text-slate-200" />
            </button>

            <a href="/dashboard" className="flex items-center">
              <ExelaLogo variant="dark" height="h-16" />
            </a>
          </div>

          {/* Right: horizontal navigation menu */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            {navItems.map((item) => {
              const isActive = active === item.key;
              const itemClass = isActive
                ? "px-3 py-2 rounded-lg bg-white/15 text-white font-medium text-[1.1rem]"
                : "px-3 py-2 rounded-lg hover:bg-white/10 text-slate-200 text-[1.1rem]";

              return (
                <a key={item.key} href={item.href} className={itemClass}>
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Vertical separator bar - outside max-w container */}
        <div className="hidden md:block h-8 w-px bg-white/20 mx-4"></div>

        {/* Notification Bell & User Avatar - outside max-w container */}
        <div className="hidden md:flex items-center gap-3">
          <NotificationBell />

          {/* User Avatar with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="focus:outline-none hover:opacity-80 transition-opacity"
              aria-label="User menu"
            >
              {staffProfile?.profile_picture ? (
                <img
                  src={staffProfile.profile_picture}
                  alt={staffProfile.full_name || "User"}
                  className="w-9 h-9 rounded-full border-2 border-sky-300 object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-sky-500 text-white font-semibold text-sm flex items-center justify-center border-2 border-sky-300">
                  {getInitials(staffProfile?.full_name || user?.name || "")}
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="text-sm font-semibold text-slate-800">
                    {staffProfile?.full_name || user?.name || "User"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {staffProfile?.email || user?.email || ""}
                  </div>
                </div>

                <a
                  href="/profile"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setDropdownOpen(false)}
                >
                  Profile
                </a>

                <a
                  href="/settings"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setDropdownOpen(false)}
                >
                  Settings
                </a>

                <div className="border-t border-gray-100 mt-1"></div>

                <a
                  href="/account/logout"
                  className="block px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  onClick={() => setDropdownOpen(false)}
                >
                  Sign Out
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
