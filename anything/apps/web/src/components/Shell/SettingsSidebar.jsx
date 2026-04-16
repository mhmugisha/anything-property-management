"use client";

import { Users, Shield, History } from "lucide-react";

export default function SettingsSidebar() {
  const menuItems = [
    {
      title: "Staff Users",
      href: "/settings?tab=users",
      icon: Users,
    },
    {
      title: "Roles",
      href: "/settings?tab=roles",
      icon: Shield,
    },
    {
      title: "Historical Sync",
      href: "/accounting/backfill",
      icon: History,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Settings Menu
        </div>
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 mb-1 rounded-lg text-slate-200 hover:bg-white/10 transition-colors"
            >
              <Icon className="w-5 h-5 flex-shrink-0 text-sky-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.title}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
