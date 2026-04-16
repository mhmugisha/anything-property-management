"use client";

import { useState } from "react";
import {
  BookOpen,
  FileText,
  TrendingUp,
  PiggyBank,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react";

export default function AccountingSidebar() {
  const [journalOpen, setJournalOpen] = useState(false);
  const [statementsOpen, setStatementsOpen] = useState(false);

  const menuItems = [
    {
      title: "Chart of Accounts",
      href: "/accounting/chart-of-accounts",
      icon: BookOpen,
    },
    {
      title: "Backfill",
      href: "/accounting/backfill",
      icon: RefreshCw,
    },
    {
      title: "Journal",
      href: "/accounting/journal",
      icon: FileText,
      isDropdown: true,
      isOpen: journalOpen,
      toggle: () => setJournalOpen(!journalOpen),
      submenu: [
        { title: "General Journal", href: "/accounting/new-entry-company" },
        {
          title: "Landlord Deduction",
          href: "/accounting/landlord-expense-deduction",
        },
        { title: "Tenant Deduction", href: "/accounting/tenant-deduction" },
        {
          title: "Post Manual Invoice",
          href: "/accounting/post-manual-invoice",
        },
        { title: "Post Arrears", href: "/accounting/post-arrears" },
        { title: "Reverse Invoice", href: "/accounting/reverse-invoice" },
      ],
    },
    {
      title: "Transfer Funds",
      href: "/accounting/transfer-funds",
      icon: ArrowRightLeft,
    },
    {
      title: "Statements",
      href: "/accounting/trial-balance",
      icon: TrendingUp,
      isDropdown: true,
      isOpen: statementsOpen,
      toggle: () => setStatementsOpen(!statementsOpen),
      submenu: [
        { title: "Trial Balance", href: "/accounting/trial-balance" },
        { title: "Balance Sheet", href: "/accounting/balance-sheet" },
        { title: "Profit & Loss", href: "/accounting/profit-loss" },
      ],
    },
    {
      title: "Deposit Funds",
      href: "/accounting/deposit-funds",
      icon: PiggyBank,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Accounting Menu
        </div>
      </div>

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isDropdown = item.isDropdown;

          return (
            <div key={item.href} className="mb-1">
              {isDropdown ? (
                <button
                  onClick={item.toggle}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <Icon className="w-5 h-5 flex-shrink-0 text-sky-400" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium">{item.title}</div>
                  </div>
                  {item.isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              ) : (
                <a
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <Icon className="w-5 h-5 flex-shrink-0 text-sky-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.title}</div>
                  </div>
                </a>
              )}

              {/* Submenu items - indented, only shown when dropdown is open */}
              {isDropdown && item.isOpen && item.submenu && (
                <div className="ml-11 mt-1 space-y-1 mb-2">
                  {item.submenu.map((subitem) => (
                    <a
                      key={subitem.href}
                      href={subitem.href}
                      className="block px-4 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {subitem.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
