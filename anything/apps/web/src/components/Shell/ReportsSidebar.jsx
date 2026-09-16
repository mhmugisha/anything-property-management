"use client";

import {
  TrendingDown,
  Receipt,
  DollarSign,
  Building,
  Users,
  BookOpen,
  ClipboardList,
  List,
  GitCompare,
  Hash,
  UserCog,
  BarChart3,
} from "lucide-react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";

export default function ReportsSidebar() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const permissions = staffQuery.data?.permissions || {};
  const canViewReports = permissions.reports === true;
  const allowedList = Array.isArray(permissions.reports_allowed)
    ? permissions.reports_allowed.map(String)
    : [];

  const reports = [
    {
      title: "Counts",
      href: "/reports?report=counts",
      key: "counts",
      icon: Hash,
    },
    {
      title: "Arrears Aging",
      href: "/reports?report=arrears",
      key: "arrears",
      icon: TrendingDown,
    },
    {
      title: "Manager Arrears",
      href: "/reports?report=manager-arrears",
      key: "manager-arrears",
      icon: UserCog,
    },
    {
      title: "Manager Comparison",
      href: "/reports?report=manager-comparison",
      key: "manager-comparison",
      icon: BarChart3,
    },
    {
      title: "Tenant Statement",
      href: "/reports?report=tenant-statement",
      key: "tenant-statement",
      icon: Users,
    },
    {
      title: "Payment Status",
      href: "/reports?report=payment-status",
      key: "payment-status",
      icon: ClipboardList,
    },
    {
      title: "Landlord Summary",
      href: "/reports?report=landlord-summary",
      key: "landlord-summary",
      icon: Receipt,
    },
    {
      title: "Payouts Summary",
      href: "/reports?report=landlord-payouts",
      key: "landlord-payouts",
      icon: DollarSign,
    },
    {
      title: "Landlord Statement",
      href: "/reports?report=landlord-statement",
      key: "landlord-statement",
      icon: DollarSign,
    },
    {
      title: "Property Statement",
      href: "/reports?report=property-statement",
      key: "property-statement",
      icon: Building,
    },
    {
      title: "All Landlords Balances",
      href: "/reports?report=all-landlords-balances",
      key: "all-landlords-balances",
      icon: DollarSign,
    },
    {
      title: "All Tenants",
      href: "/reports?report=all-tenants",
      key: "all-tenants",
      icon: List,
    },
    {
      // External page — only visible with blanket reports permission.
      title: "Reconciliation",
      href: "/reports/reconciliation",
      key: null,
      external: true,
      icon: GitCompare,
    },
    {
      // Cross-nav — requires accounting; only for admins/reports role.
      title: "To Accounting",
      href: "/accounting/chart-of-accounts",
      key: null,
      external: true,
      icon: BookOpen,
    },
  ];

  const visibleReports = reports.filter((r) => {
    if (canViewReports) return true;
    if (r.external) return false;
    return r.key && allowedList.includes(r.key);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Reports Menu
        </div>
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {visibleReports.map((report) => {
          const Icon = report.icon;
          return (
            <a
              key={report.href}
              href={report.href}
              className="flex items-center gap-3 px-4 py-2.5 mb-1 rounded-lg text-slate-200 hover:bg-white/10 transition-colors"
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
