"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import { fetchJson } from "@/utils/api";
import { formatDate } from "@/utils/formatDate";
import {
  User,
  Phone,
  Mail,
  CreditCard,
  AlertTriangle,
  Building2,
  Home,
  Calendar,
  DollarSign,
  Shield,
  Printer,
  ArrowLeft,
} from "lucide-react";

function ReadOnlyField({ label, value, icon }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-slate-800 min-h-[38px] flex items-center">
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function formatCurrencyLocal(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function TenantViewDetailsPage() {
  const [tenantId, setTenantId] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) setTenantId(Number(id));
    }
  }, []);

  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const canManageTenants = staffQuery.data?.permissions?.tenants === true;

  // Fetch tenant details
  const tenantQuery = useQuery({
    queryKey: ["tenants", "detail", tenantId],
    queryFn: async () => {
      const data = await fetchJson(`/api/tenants/${tenantId}`);
      return data.tenant || null;
    },
    enabled: !userLoading && !!user && canManageTenants && !!tenantId,
  });

  // Fetch tenant leases (includes property_name, landlord_id, unit_number)
  const leasesQuery = useQuery({
    queryKey: ["tenants", tenantId, "leases"],
    queryFn: async () => {
      const data = await fetchJson(`/api/tenants/${tenantId}/leases`);
      return data.leases || [];
    },
    enabled: !userLoading && !!user && canManageTenants && !!tenantId,
  });

  const tenant = tenantQuery.data || null;
  const leases = leasesQuery.data || [];

  // Get the active or most recent lease
  const currentLease = useMemo(() => {
    const active = leases.find((l) => l.status === "active");
    if (active) return active;
    return leases[0] || null;
  }, [leases]);

  // Fetch landlord name if we have a landlord_id from the lease
  const landlordId = currentLease?.landlord_id || null;
  const landlordQuery = useQuery({
    queryKey: ["landlords", "detail", landlordId],
    queryFn: async () => {
      const data = await fetchJson(`/api/landlords/${landlordId}`);
      return data.landlord || null;
    },
    enabled: !!landlordId,
  });

  const landlord = landlordQuery.data || null;

  const isLoading = userLoading || staffQuery.isLoading;

  const onPrint = () => {
    if (typeof window === "undefined") return;

    const escapeHtml = (str) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const titlePrefix = tenant?.title ? `${tenant.title} ` : "";
    const fullName = tenant?.full_name || "Tenant";
    const pageTitle = `Tenant Details – ${titlePrefix}${fullName}`;

    const leaseStatus = currentLease?.status || "—";
    const leaseStart = currentLease?.start_date
      ? formatDate(currentLease.start_date)
      : "—";
    const leaseEnd = currentLease?.end_date
      ? formatDate(currentLease.end_date)
      : "—";
    const monthlyRent = currentLease?.monthly_rent
      ? `${currentLease.currency || "UGX"} ${formatCurrencyLocal(currentLease.monthly_rent)}`
      : "—";
    const deposit = currentLease?.deposit_amount
      ? `${currentLease.currency || "UGX"} ${formatCurrencyLocal(currentLease.deposit_amount)}`
      : "—";

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    @page { size: portrait; margin: 0.6in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.5;
    }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #334155; }
    .header h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .meta { font-size: 11px; color: #475569; margin-top: 4px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 600; color: #1e293b; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .field-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
    .field-value { font-size: 12px; color: #1e293b; margin-top: 2px; padding: 4px 0; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .active { background: #dcfce7; color: #166534; }
    .ended { background: #fef3c7; color: #92400e; }
    .archived { background: #fee2e2; color: #991b1b; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Tenant Registration Details</h1>
    <div class="meta">Generated on ${new Date().toLocaleDateString("en-GB")}</div>
  </div>

  <div class="section">
    <div class="section-title">Personal Information</div>
    <div class="grid">
      <div><div class="field-label">Title</div><div class="field-value">${escapeHtml(tenant?.title || "—")}</div></div>
      <div><div class="field-label">Full Name</div><div class="field-value">${escapeHtml(tenant?.full_name || "—")}</div></div>
      <div><div class="field-label">Phone</div><div class="field-value">${escapeHtml(tenant?.phone || "—")}</div></div>
      <div><div class="field-label">Email</div><div class="field-value">${escapeHtml(tenant?.email || "—")}</div></div>
      <div><div class="field-label">National ID</div><div class="field-value">${escapeHtml(tenant?.national_id || "—")}</div></div>
      <div><div class="field-label">Status</div><div class="field-value"><span class="status-badge ${tenant?.status === "archived" ? "archived" : "active"}">${escapeHtml(tenant?.status || "—")}</span></div></div>
      <div><div class="field-label">Emergency Phone</div><div class="field-value">${escapeHtml(tenant?.emergency_phone || "—")}</div></div>
      <div><div class="field-label">Emergency Contact</div><div class="field-value">${escapeHtml(tenant?.emergency_contact || "—")}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Property &amp; Landlord</div>
    <div class="grid">
      <div><div class="field-label">Landlord</div><div class="field-value">${escapeHtml(landlord ? `${landlord.title ? landlord.title + " " : ""}${landlord.full_name}` : "—")}</div></div>
      <div><div class="field-label">Property</div><div class="field-value">${escapeHtml(currentLease?.property_name || "—")}</div></div>
      <div><div class="field-label">Unit Number</div><div class="field-value">${escapeHtml(currentLease?.unit_number || "—")}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Lease Details</div>
    <div class="grid">
      <div><div class="field-label">Lease Status</div><div class="field-value"><span class="status-badge ${leaseStatus === "active" ? "active" : "ended"}">${escapeHtml(leaseStatus)}</span></div></div>
      <div><div class="field-label">Currency</div><div class="field-value">${escapeHtml(currentLease?.currency || "UGX")}</div></div>
      <div><div class="field-label">Start Date</div><div class="field-value">${escapeHtml(leaseStart)}</div></div>
      <div><div class="field-label">End Date</div><div class="field-value">${escapeHtml(leaseEnd)}</div></div>
      <div><div class="field-label">Monthly Rent</div><div class="field-value">${escapeHtml(monthlyRent)}</div></div>
      <div><div class="field-label">Security Deposit</div><div class="field-value">${escapeHtml(deposit)}</div></div>
    </div>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch (e) {
        console.error("Print failed", e);
      }
    }, 300);
  };

  if (isLoading) {
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

  if (!staffQuery.data) {
    if (typeof window !== "undefined") window.location.href = "/onboarding";
    return null;
  }

  if (!canManageTenants) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Access denied</p>
      </div>
    );
  }

  const titlePrefix = tenant?.title ? `${tenant.title} ` : "";
  const tenantStatusBadge =
    tenant?.status === "archived"
      ? "bg-rose-100 text-rose-700"
      : tenant?.status === "active"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700";

  const leaseStatusBadge =
    currentLease?.status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : currentLease?.status === "ended"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";

  const landlordName = landlord
    ? `${landlord.title ? landlord.title + " " : ""}${landlord.full_name}`
    : "—";

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader title="View Tenant Details" active="tenants" />

      <main className="pt-32">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          {/* Back link + Print button */}
          <div className="mb-4 flex items-center justify-between">
            <a
              href="/tenants"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </a>
            <button
              type="button"
              onClick={onPrint}
              disabled={!tenant}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50 text-sm"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
          </div>

          {tenantQuery.isLoading || leasesQuery.isLoading ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Loading tenant details...</p>
            </div>
          ) : tenantQuery.error ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-rose-600">Could not load tenant details.</p>
            </div>
          ) : !tenant ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
              <p className="text-slate-500">Tenant not found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {titlePrefix}
                      {tenant.full_name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {tenant.phone}
                      {tenant.email ? ` • ${tenant.email}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${tenantStatusBadge}`}
                  >
                    {tenant.status || "active"}
                  </span>
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <SectionHeader
                  title="Personal Information"
                  subtitle="Tenant registration details"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ReadOnlyField
                    label="Title"
                    value={tenant.title}
                    icon={<User className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Full Name"
                    value={tenant.full_name}
                    icon={<User className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Phone"
                    value={tenant.phone}
                    icon={<Phone className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Email"
                    value={tenant.email}
                    icon={<Mail className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="National ID"
                    value={tenant.national_id}
                    icon={<CreditCard className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Status"
                    value={
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${tenantStatusBadge}`}
                      >
                        {tenant.status || "active"}
                      </span>
                    }
                    icon={<Shield className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Emergency Phone"
                    value={tenant.emergency_phone}
                    icon={<AlertTriangle className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Emergency Contact"
                    value={tenant.emergency_contact}
                    icon={<AlertTriangle className="w-3 h-3" />}
                  />
                </div>
              </div>

              {/* Property & Landlord */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <SectionHeader
                  title="Property & Landlord"
                  subtitle="Current assignment"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ReadOnlyField
                    label="Landlord"
                    value={
                      landlordQuery.isLoading ? "Loading..." : landlordName
                    }
                    icon={<User className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Property"
                    value={currentLease?.property_name}
                    icon={<Building2 className="w-3 h-3" />}
                  />
                  <ReadOnlyField
                    label="Unit Number"
                    value={currentLease?.unit_number}
                    icon={<Home className="w-3 h-3" />}
                  />
                </div>
              </div>

              {/* Lease Details */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <SectionHeader
                  title="Lease Details"
                  subtitle={
                    currentLease
                      ? `Lease #${currentLease.id}`
                      : "No lease found"
                  }
                />
                {currentLease ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ReadOnlyField
                      label="Lease Status"
                      value={
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${leaseStatusBadge}`}
                        >
                          {currentLease.status}
                        </span>
                      }
                      icon={<Shield className="w-3 h-3" />}
                    />
                    <ReadOnlyField
                      label="Currency"
                      value={currentLease.currency || "UGX"}
                      icon={<DollarSign className="w-3 h-3" />}
                    />
                    <ReadOnlyField
                      label="Start Date"
                      value={formatDate(currentLease.start_date)}
                      icon={<Calendar className="w-3 h-3" />}
                    />
                    <ReadOnlyField
                      label="End Date"
                      value={
                        currentLease.end_date
                          ? formatDate(currentLease.end_date)
                          : "Open-ended"
                      }
                      icon={<Calendar className="w-3 h-3" />}
                    />
                    <ReadOnlyField
                      label="Monthly Rent"
                      value={`${currentLease.currency || "UGX"} ${formatCurrencyLocal(currentLease.monthly_rent)}`}
                      icon={<DollarSign className="w-3 h-3" />}
                    />
                    <ReadOnlyField
                      label="Security Deposit"
                      value={
                        currentLease.deposit_amount
                          ? `${currentLease.currency || "UGX"} ${formatCurrencyLocal(currentLease.deposit_amount)}`
                          : null
                      }
                      icon={<DollarSign className="w-3 h-3" />}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No lease information available for this tenant.
                  </p>
                )}
              </div>

              {/* Lease History */}
              {leases.length > 1 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <SectionHeader
                    title="Lease History"
                    subtitle={`${leases.length} lease(s) on record`}
                  />
                  <div className="space-y-2 max-h-[400px] overflow-auto">
                    {leases.map((l) => {
                      const lLabel = `${l.property_name || "Unknown"} • Unit ${l.unit_number || "?"}`;
                      const lDates = `${formatDate(l.start_date)} → ${l.end_date ? formatDate(l.end_date) : "Open"}`;
                      const lAmount = `${l.currency || "UGX"} ${formatCurrencyLocal(l.monthly_rent)}`;
                      const lBadge =
                        l.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700";

                      return (
                        <div
                          key={l.id}
                          className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 text-sm">
                              {lLabel}
                            </div>
                            <div className="text-xs text-slate-500">
                              {lDates}
                            </div>
                            <div className="text-xs text-slate-700 mt-0.5">
                              {lAmount}/month
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${lBadge}`}
                          >
                            {l.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
