"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import useUser from "@/utils/useUser";
import { useStaffProfile } from "@/hooks/useStaffProfile";
import AppHeader from "@/components/Shell/AppHeader";
import Sidebar from "@/components/Shell/Sidebar";
import MobileMenu from "@/components/Shell/MobileMenu";
import DashboardSidebar from "@/components/Shell/DashboardSidebar";
import AccessDenied from "@/components/Shell/AccessDenied";
import DatePopoverInput from "@/components/DatePopoverInput";
import { useReportsLookups } from "@/hooks/useReportsLookups";
import { usePaymentNote } from "@/hooks/usePaymentNote";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import { formatDate } from "@/utils/formatters";
import { Printer } from "lucide-react";

function monthLabel(year, month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = months[(Number(month) || 1) - 1] || "";
  const y = Number(year) || "";
  const yy = String(y).slice(-2);
  return `${m} ${yy}`.trim();
}

function monthLabelFull(year, month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = months[(Number(month) || 1) - 1] || "";
  const y = Number(year) || "";
  return `${m} ${y}`.trim();
}

function formatAmount(amount, currency) {
  const c = String(currency || "UGX");
  if (c === "UGX") {
    return formatCurrencyUGX(amount);
  }

  const n = Number(amount || 0);
  const text = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

  return `${text} (${c})`;
}

function isFullMonthRange(from, to) {
  if (!from || !to) return false;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;

  const sameMonth =
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (!sameMonth) return false;

  const fromIsFirst = a.getDate() === 1;
  const lastDay = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  const toIsLast = b.getDate() === lastDay;

  return fromIsFirst && toIsLast;
}

function monthWords(year, month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = months[(Number(month) || 1) - 1] || "";
  const y = Number(year) || "";
  const yy = String(y).slice(-2);
  return `${m} ${yy}`.trim();
}

export default function PaymentNotePage() {
  const { data: user, loading: userLoading } = useUser();
  const staffQuery = useStaffProfile(!userLoading && !!user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canViewReports = staffQuery.data?.permissions?.reports === true;

  const now = useMemo(() => new Date(), []);
  const defaultDocDate = useMemo(() => now.toISOString().slice(0, 10), [now]);
  const defaultFrom = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().slice(0, 10);
  }, [now]);
  const defaultTo = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const [docDate, setDocDate] = useState(defaultDocDate);
  const [landlordId, setLandlordId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [notes, setNotes] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  // Deep links like:
  // /reports/payment-note?landlordId=1&propertyId=2&from=2026-01-01&to=2026-01-31
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);

    const qDocDate = sp.get("date");
    const qLandlordId = sp.get("landlordId");
    const qPropertyId = sp.get("propertyId");
    const qFrom = sp.get("from");
    const qTo = sp.get("to");

    if (qDocDate) setDocDate(qDocDate);
    if (qLandlordId) setLandlordId(qLandlordId);
    if (qPropertyId) setPropertyId(qPropertyId);
    if (qFrom) setFrom(qFrom);
    if (qTo) setTo(qTo);
  }, []);

  const isLoading = userLoading || staffQuery.isLoading;

  const lookups = useReportsLookups(!isLoading && !!user && canViewReports);
  const landlords = lookups.landlordLookupQuery.data || [];
  const allProperties = lookups.propertyLookupQuery.data || [];

  const propertiesLoading = lookups.propertyLookupQuery.isLoading;

  const properties = useMemo(() => {
    if (!landlordId) return [];
    return (allProperties || []).filter(
      (p) => String(p.landlord_id) === String(landlordId),
    );
  }, [allProperties, landlordId]);

  // If landlord changes, reset property selection (so we can't mismatch)
  useEffect(() => {
    setPropertyId("");
  }, [landlordId]);

  const selectedLandlord = useMemo(() => {
    return landlords.find((l) => String(l.id) === String(landlordId)) || null;
  }, [landlords, landlordId]);

  const selectedProperty = useMemo(() => {
    return properties.find((p) => String(p.id) === String(propertyId)) || null;
  }, [properties, propertyId]);

  const landlordDisplayName = useMemo(() => {
    const l = selectedLandlord;
    if (!l) return "";
    const title = l.title ? `${l.title} ` : "";
    return `${title}${l.full_name || ""}`.trim();
  }, [selectedLandlord]);

  const propertyDisplayName = selectedProperty?.property_name || "";

  const propertySelectPlaceholder = useMemo(() => {
    if (!landlordId) return "Select landlord first…";
    if (propertiesLoading) return "Loading properties…";
    return "Select property…";
  }, [landlordId, propertiesLoading]);

  const noteEnabled =
    !isLoading &&
    !!user &&
    canViewReports &&
    !!landlordId &&
    !!propertyId &&
    !!from &&
    !!to;

  const paymentNoteQuery = usePaymentNote(
    { landlordId, propertyId, from, to },
    noteEnabled,
  );

  const invoices = paymentNoteQuery.data?.invoices || [];
  const recoveredArrears = paymentNoteQuery.data?.recovered_arrears || [];
  const deductions = paymentNoteQuery.data?.deductions || [];
  const totals = paymentNoteQuery.data?.totals || [];

  const singleTotals = useMemo(() => {
    return totals.length === 1 ? totals[0] : null;
  }, [totals]);

  const payableLine = useMemo(() => {
    if (totals.length === 0) return [];
    return totals.map((t) => {
      const currency = String(t.currency || "UGX");
      const netText = formatAmount(t.net_payable, currency);
      const label =
        totals.length === 1
          ? "Payable this Month:"
          : `Payable this Month (${currency}):`;
      return { currency, label, value: netText };
    });
  }, [totals]);

  const periodText = useMemo(() => {
    if (!from || !to) return "";

    if (isFullMonthRange(from, to)) {
      const a = new Date(from);
      return monthWords(a.getFullYear(), a.getMonth() + 1);
    }

    return `${formatDate(from)} → ${formatDate(to)}`;
  }, [from, to]);

  // NEW: print-only layout helpers
  const headerDateText = useMemo(() => {
    return formatDate(docDate);
  }, [docDate]);

  const summaryRows = useMemo(() => {
    const landlordText = landlordDisplayName || "—";
    const propertyText = propertyDisplayName || "—";
    const periodValue = periodText || "—";

    return {
      landlordText,
      propertyText,
      periodValue,
    };
  }, [landlordDisplayName, propertyDisplayName, periodText]);

  const payableFontStyle = useMemo(() => {
    if (!isPrinting) return undefined;
    // text-sm is ~0.875rem; +20% => ~1.05rem
    return { fontSize: "1.05rem" };
  }, [isPrinting]);

  const payableWrapClass = useMemo(() => {
    return isPrinting
      ? "mt-3 space-y-1 text-right"
      : "mt-4 space-y-1 text-right";
  }, [isPrinting]);

  const pagePaddingClass = useMemo(() => {
    return isPrinting ? "py-2" : "py-6";
  }, [isPrinting]);

  const cardPaddingClass = useMemo(() => {
    return isPrinting ? "p-4" : "p-5 md:p-6";
  }, [isPrinting]);

  const summaryPaddingClass = useMemo(() => {
    return isPrinting ? "p-3" : "p-4";
  }, [isPrinting]);

  const sectionSpacingClass = useMemo(() => {
    return isPrinting ? "mt-5" : "mt-6";
  }, [isPrinting]);

  const sectionTitleClass = useMemo(() => {
    return isPrinting
      ? "text-base font-semibold text-slate-800 mb-1"
      : "text-lg font-semibold text-slate-800 mb-2";
  }, [isPrinting]);

  const cellPadClass = useMemo(() => {
    return isPrinting ? "py-1 px-2" : "py-2 px-3";
  }, [isPrinting]);

  const cellPadRightClass = useMemo(() => {
    return isPrinting ? "py-1 px-2 text-right" : "py-2 px-3 text-right";
  }, [isPrinting]);

  const noteRef = useRef(null);

  const handlePrint = useCallback(() => {
    if (typeof window === "undefined") return;

    // Hide form controls while the print dialog is open.
    setIsPrinting(true);

    // Let React render the print-friendly layout before printing.
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error("Failed to print", e);
        setIsPrinting(false);
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAfterPrint = () => {
      setIsPrinting(false);
    };

    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

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

  if (!canViewReports) {
    return (
      <AccessDenied
        title="Payment Note"
        message="You don't have access to reports."
      />
    );
  }

  const showData = !!landlordId && !!propertyId;
  const dataError = paymentNoteQuery.error;

  return (
    <div className="min-h-screen bg-slate-200 font-inter">
      <AppHeader
        title="Payment Note"
        onMenuToggle={() => setMobileMenuOpen(true)}
        active="reports"
      />
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        active="reports"
      />
      <Sidebar active="reports">
        <DashboardSidebar />
      </Sidebar>

      <main className="pt-32 md:pl-[270px]">
        <div className={`p-4 md:p-6 ${pagePaddingClass}`}>
          {!isPrinting ? (
            <div className="flex items-center justify-end gap-3 mb-4">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c]"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </button>
            </div>
          ) : null}

          <div
            ref={noteRef}
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${cardPaddingClass}`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="text-2xl font-semibold text-slate-900">
                Payment Note
              </div>

              {isPrinting ? (
                <div className="text-sm text-slate-700 text-right">
                  <span className="font-medium">Date:</span> {headerDateText}
                </div>
              ) : (
                <div className="w-full md:w-[260px]">
                  <div className="text-xs font-medium text-slate-600 mb-1">
                    Date
                  </div>
                  <DatePopoverInput
                    value={docDate}
                    onChange={setDocDate}
                    placeholder="DD-MM-YYYY"
                  />
                </div>
              )}
            </div>

            {/* Summary block */}
            <div
              className={`mt-2 rounded-xl border border-gray-100 bg-slate-50 ${summaryPaddingClass}`}
            >
              {!isPrinting ? (
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Date:</span>{" "}
                  {formatDate(docDate)}
                </div>
              ) : null}

              {/* Landlord + Property + Period all on one row if it fits, wrap if needed */}
              <div className="text-sm text-slate-700 flex flex-wrap gap-x-8 gap-y-1">
                <div>
                  <span className="font-medium">Landlord:</span>{" "}
                  {summaryRows.landlordText}
                </div>
                <div>
                  <span className="font-medium">Property:</span>{" "}
                  {summaryRows.propertyText}
                </div>
                <div>
                  <span className="font-medium">Period:</span>{" "}
                  {summaryRows.periodValue}
                </div>
              </div>
            </div>

            {!isPrinting ? (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Landlord Name">
                  <select
                    value={landlordId}
                    onChange={(e) => setLandlordId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
                  >
                    <option value="">Select landlord…</option>
                    {landlords.map((l) => {
                      const title = l.title ? `${l.title} ` : "";
                      const label = `${title}${l.full_name}`;
                      return (
                        <option key={l.id} value={l.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field label="Property Name">
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    disabled={!landlordId || propertiesLoading}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none disabled:opacity-60"
                  >
                    <option value="">{propertySelectPlaceholder}</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.property_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Period Covered (From)">
                  <DatePopoverInput
                    value={from}
                    onChange={setFrom}
                    placeholder="DD-MM-YYYY"
                  />
                </Field>

                <Field label="Period Covered (To)">
                  <DatePopoverInput
                    value={to}
                    onChange={setTo}
                    placeholder="DD-MM-YYYY"
                  />
                </Field>
              </div>
            ) : null}

            <div className={sectionSpacingClass}>
              <h2 className={sectionTitleClass}>Tenant Rent Breakdown</h2>

              {!showData ? (
                <div className="text-sm text-slate-500">
                  Select a landlord and property to load the breakdown.
                </div>
              ) : paymentNoteQuery.isLoading ? (
                <div className="text-sm text-slate-500">
                  Loading rent lines…
                </div>
              ) : dataError ? (
                <div className="text-sm text-rose-600">
                  Could not load payment note.
                </div>
              ) : invoices.length === 0 && recoveredArrears.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No invoices or recovered arrears found for this property in
                  the selected period.
                </div>
              ) : (
                <div className="overflow-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b bg-white">
                        <th className={`${cellPadClass} whitespace-nowrap`}>
                          Unit Number
                        </th>
                        <th className={cellPadClass}>Description</th>
                        <th
                          className={`${cellPadRightClass} whitespace-nowrap`}
                        >
                          Rent Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Current month invoices */}
                      {invoices.map((inv) => {
                        // For rent invoices (auto-generated), format as "Rent for: April 2026 - Tenant Name"
                        // Check if it's a rent invoice by looking at the description pattern
                        const isRentInvoice =
                          inv.description &&
                          inv.description.startsWith("Rent for:");

                        let desc;
                        if (isRentInvoice) {
                          // Append tenant name to existing rent description
                          desc = `${inv.description} - ${inv.tenant_name}`;
                        } else if (!inv.description) {
                          // If no description, create the full rent description
                          desc = `Rent for: ${monthLabelFull(inv.invoice_year, inv.invoice_month)} - ${inv.tenant_name}`;
                        } else {
                          // Manual invoice with custom description - use as-is
                          desc = inv.description;
                        }

                        const amountText = formatAmount(
                          inv.amount,
                          inv.currency,
                        );

                        return (
                          <tr key={inv.id} className="border-b">
                            <td className={`${cellPadClass} whitespace-nowrap`}>
                              {inv.unit_number || "—"}
                            </td>
                            <td className={cellPadClass}>{desc}</td>
                            <td
                              className={`${cellPadRightClass} font-medium text-slate-800 whitespace-nowrap`}
                            >
                              {amountText}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Subtotal: Current Month Rent */}
                      {singleTotals && invoices.length > 0 ? (
                        <tr className="bg-slate-50 border-b">
                          <td className={cellPadClass} />
                          <td
                            className={`${cellPadClass} font-semibold text-slate-800`}
                          >
                            Current Month Rent
                          </td>
                          <td
                            className={`${cellPadRightClass} font-semibold text-slate-900 whitespace-nowrap`}
                          >
                            {formatAmount(
                              singleTotals.current_month_rent,
                              singleTotals.currency,
                            )}
                          </td>
                        </tr>
                      ) : null}

                      {/* Recovered arrears - numbered sequentially */}
                      {recoveredArrears.map((arr, idx) => {
                        const seqNum = idx + 1;
                        const amountText = formatAmount(
                          arr.amount,
                          arr.currency,
                        );
                        return (
                          <tr
                            key={`arrears-${arr.allocation_id || arr.invoice_id}-${idx}`}
                            className="border-b"
                          >
                            <td className={`${cellPadClass} whitespace-nowrap`}>
                              {seqNum}
                            </td>
                            <td className={cellPadClass}>{arr.description}</td>
                            <td
                              className={`${cellPadRightClass} font-medium text-slate-800 whitespace-nowrap`}
                            >
                              {amountText}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total Rent = Current Month + Recovered Arrears */}
                      {singleTotals ? (
                        <tr className="bg-slate-100">
                          <td className={cellPadClass} />
                          <td
                            className={`${cellPadClass} font-bold text-slate-900`}
                          >
                            Total Rent
                          </td>
                          <td
                            className={`${cellPadRightClass} font-bold text-slate-900 whitespace-nowrap`}
                          >
                            {formatAmount(
                              singleTotals.total_rent,
                              singleTotals.currency,
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={isPrinting ? "mt-6" : "mt-8"}>
              <h2 className={sectionTitleClass}>Deductions</h2>

              <div className="overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b bg-white">
                      <th className={`${cellPadClass} w-[56px]`}>#</th>
                      <th className={cellPadClass}>Deduction Description</th>
                      <th className={`${cellPadRightClass} whitespace-nowrap`}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((t) => {
                      const feesText = formatAmount(
                        t.management_fees,
                        t.currency,
                      );
                      const feesLabel =
                        t.currency === "UGX"
                          ? "Management fees"
                          : `Management fees (${t.currency})`;

                      return (
                        <tr key={`fees-${t.currency}`} className="border-b">
                          <td className={cellPadClass}>1</td>
                          <td className={cellPadClass}>{feesLabel}</td>
                          <td
                            className={`${cellPadRightClass} font-medium text-slate-800 whitespace-nowrap`}
                          >
                            {feesText}
                          </td>
                        </tr>
                      );
                    })}

                    {deductions.length === 0 ? (
                      <tr>
                        <td
                          className={`${cellPadClass} text-slate-500`}
                          colSpan={3}
                        >
                          No landlord deductions found in this period.
                        </td>
                      </tr>
                    ) : (
                      deductions.map((d, idx) => {
                        const n = idx + 2;
                        const amtText = formatAmount(d.amount, "UGX");
                        const desc = d.description || "Deduction";

                        return (
                          <tr key={d.id} className="border-b last:border-b-0">
                            <td className={cellPadClass}>{n}</td>
                            <td className={cellPadClass}>{desc}</td>
                            <td
                              className={`${cellPadRightClass} font-medium text-slate-800 whitespace-nowrap`}
                            >
                              {amtText}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {singleTotals ? (
                      <tr className="bg-slate-50">
                        <td className={cellPadClass} />
                        <td
                          className={`${cellPadClass} font-semibold text-slate-800`}
                        >
                          Total Deductions
                        </td>
                        <td
                          className={`${cellPadRightClass} font-semibold text-slate-900 whitespace-nowrap`}
                        >
                          {formatAmount(
                            singleTotals.total_deductions,
                            singleTotals.currency,
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {payableLine.length > 0 ? (
                <div className={payableWrapClass}>
                  {payableLine.map((p) => {
                    const lineClass = isPrinting
                      ? "text-slate-800"
                      : "text-sm text-slate-800";
                    // Calculate 10% increase: text-sm is 0.875rem, +10% = 0.9625rem
                    const valueFontSize = "0.9625rem";
                    return (
                      <div key={p.currency} className={lineClass}>
                        <span className="font-medium">{p.label}</span>{" "}
                        <span
                          className="font-bold"
                          style={{ fontSize: valueFontSize }}
                        >
                          {p.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className={isPrinting ? "mt-6" : "mt-8"}>
              <h2 className={sectionTitleClass}>Notes</h2>

              {!isPrinting ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white outline-none"
                  placeholder="Write notes / remarks..."
                />
              ) : (
                <div className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white min-h-[56px] whitespace-pre-wrap">
                  {notes || ""}
                </div>
              )}
            </div>

            {/* Footer sign-off */}
            <div
              className={
                isPrinting
                  ? "mt-6 grid grid-cols-2 gap-6"
                  : "mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"
              }
            >
              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">
                  Prepared By:
                </div>
                <div className="h-[44px] border-b border-gray-300" />
              </div>

              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">
                  Approved By:
                </div>
                <div className="h-[44px] border-b border-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {children}
    </div>
  );
}
