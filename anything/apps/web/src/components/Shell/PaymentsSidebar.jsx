"use client";

import {
  Receipt,
  DollarSign,
  Wallet,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

export default function PaymentsSidebar() {
  const menuItems = [
    {
      title: "Payments",
      href: "/payments",
      icon: Receipt,
    },
    {
      title: "Pay on Account",
      href: "/payments/payment-on-account",
      icon: Wallet,
    },
    {
      title: "Pay Invoice",
      href: "/payments/pay-invoice",
      icon: DollarSign,
    },
    {
      title: "Auto Apply",
      href: "/payments/auto-apply",
      icon: RefreshCw,
    },
    {
      title: "Open Balances",
      href: "/payments/open-balances",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Payments Menu
        </div>
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 mx-2 mb-1 rounded-lg text-slate-200 hover:bg-white/10 transition-colors"
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
