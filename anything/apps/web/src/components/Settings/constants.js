export const TAB_USERS = "users";
export const TAB_ROLES = "roles";

export const PERMISSION_DEFS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "properties", label: "Landlords & Properties" },
  { key: "tenants", label: "Tenants" },
  { key: "payments", label: "Payments" },
  { key: "reports", label: "Reports" },
  { key: "accounting", label: "Accounting" },
  { key: "payroll", label: "Payroll" },
  { key: "maintenance", label: "Maintenance" },
];

// Reports that are safe to expose to a role via reports_allowed even
// when the blanket "reports" permission is off. A report belongs here
// only if its backend route enforces manager-scoped access (see
// utils/managerScope + requireReportAccess).
export const MANAGER_SAFE_REPORT_DEFS = [
  { key: "manager-arrears", label: "Manager Arrears" },
];
