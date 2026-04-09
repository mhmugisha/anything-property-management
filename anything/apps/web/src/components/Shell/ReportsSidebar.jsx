"use client";

import {
  TrendingDown,
  Receipt,
  DollarSign,
  Building,
  Users,
  BookOpen,
  ClipboardList,
  FileText,
  List,
} from "lucide-react";

export default function ReportsSidebar() {
  const reports = [
    {
      title: "Arrears Aging",
      href: "/reports?report=arrears",
      icon: TrendingDown,
    },
    {
      title: "Tenant Statement",
      href: "/reports?report=tenant-statement",
      icon: Users,
    },
    {
      title: "Payment Status",
      href: "/reports?report=payment-status",
      icon: ClipboardList,
    },
    {
      title: "Landlord Summary",
      href: "/reports?report=landlord-summary",
      icon: Receipt,
    },
    {
      title: "Payouts Summary",
      href: "/reports?report=landlord-payouts",
      icon: DollarSign,
    },
    {
      title: "Landlord Statement",
      href: "/reports?report=landlord-statement",
      icon: DollarSign,
    },
    {
      title: "Property Statement",
      href: "/reports?report=property-statement",
      icon: Building,
    },
    {
      title: "Consolidated Balances Due",
      href: "/reports?report=consolidated-balances-due",
      icon: FileText,
    },
    {
      title: "All Tenants",
      href: "/reports?report=all-tenants",
      icon: List,
    },
    {
      title: "To Accounting",
      href: "/accounting/chart-of-accounts",
      icon: BookOpen,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-600">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Reports Menu
        </div>
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto py-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <a
              key={report.href}
              href={report.href}
              className="flex items-center gap-3 px-3 py-2.5 mx-2 mb-1 rounded-lg text-slate-200 hover:bg-white/10 transition-colors"
            >
              <Icon className="w-5 h-5 flex-shrink-0 text-sky-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{report.title}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
