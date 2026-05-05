import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ReceiptText, Printer, DollarSign } from "lucide-react";
import { fetchJson } from "@/utils/api";
import { SummaryCard } from "@/components/Reports/SummaryCard";
import DatePopoverInput from "@/components/DatePopoverInput";
import { formatDate } from "@/utils/formatters";
import { downloadCsv } from "@/utils/downloadCsv";
import { formatCurrencyUGX } from "@/utils/formatCurrency";

export function TenantReadOnlyView({ selectedTenant }) {
  const printRef = useRef(null);
  const [from, setFrom] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return end.toISOString().slice(0, 10);
  });

  const statementQuery = useQuery({
    queryKey: ["reports", "tenantStatement", selectedTenant?.id, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("tenantId", String(selectedTenant.id));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return await fetchJson(`/api/reports/tenant-statement?${params.toString()}`);
    },
    enabled: !!selectedTenant?.id,
  });

  const statement = statementQuery.data || null;
  const invoices = statement?.invoices || [];
  const payments = statement?.payments || [];
  const deductions = statement?.deductions || [];
  const leases = statement?.leases || [];
  const openingBalance = Number(statement?.openingBalance ?? 0);
  const unitNumber = leases[0]?.unit_number || null;
  const propertyName = leases[0]?.property_name || null;

  // Merge invoices, payments, deductions into flat rows filtered by from/to, sorted ascending
  const mergedRows = useMemo(() => {
    const all = [
      ...invoices.map((i) => ({
        date: i.invoice_date ? String(i.invoice_date).slice(0, 10) : "",
        reference_number: "",
        description: i.description || `Invoice #${i.id}`,
        debit: Number(i.amount || 0),
        credit: 0,
        kind: "invoice",
      })),
      ...payments.map((p) => ({
        date: p.payment_date ? String(p.payment_date).slice(0, 10) : "",
        reference_number: p.reference_number || "",
        description: p.notes || "Payment",
        debit: 0,
        credit: Number(p.invoice_amount_applied || 0),
        kind: "payment",
      })),
      ...deductions.map((d) => ({
        date: d.deduction_date ? String(d.deduction_date).slice(0, 10) : "",
        reference_number: "",
        description: d.description || "Deduction",
        debit: Number(d.amount || 0),
        credit: 0,
        kind: "deduction",
      })),
    ].filter((r) => {
      if (from && r.date && r.date < from) return false;
      if (to && r.date && r.date > to) return false;
      return true;
    });

    all.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return all;
  }, [invoices, payments, deductions, from, to]);

  // Add running balance to each row, starting from openingBalance
  const rows = useMemo(() => {
    let bal = openingBalance;
    return mergedRows.map((r) => {
      bal = bal + r.debit - r.credit;
      return { ...r, balance: bal };
    });
  }, [mergedRows, openingBalance]);

  const safeFilenameBase = useMemo(() => {
    const name = `${selectedTenant?.full_name || "tenant"}-statement`;
    const cleaned = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return cleaned || "tenant-statement";
  }, [selectedTenant?.full_name]);

  const canExport = Array.isArray(rows) && rows.length > 0;

  const onExport = useCallback(() => {
    if (!canExport) return;

    const openingRow = from
      ? [
          {
            Date: from,
            "Receipt #": "",
            Description: "Opening Balance",
            "Debit (UGX)": "",
            "Credit (UGX)": "",
            "Balance (UGX)": openingBalance,
          },
        ]
      : [];

    const exportRows = [
      ...openingRow,
      ...rows.map((r) => {
        const dateValue = r?.date ? String(r.date).slice(0, 10) : "";
        return {
          Date: dateValue,
          "Receipt #": r?.reference_number || "",
          Description: r?.description || "",
          "Debit (UGX)":
            r?.debit != null && r.debit !== "" ? Number(r.debit) : "",
          "Credit (UGX)":
            r?.credit != null && r.credit !== "" ? Number(r.credit) : "",
          "Balance (UGX)":
            r?.balance != null && r.balance !== "" ? Number(r.balance) : "",
        };
      }),
    ];

    const fromPart = from ? String(from).slice(0, 10) : "";
    const toPart = to ? String(to).slice(0, 10) : "";
    const rangeSuffix = fromPart && toPart ? `-${fromPart}-to-${toPart}` : "";
    const filename = `${safeFilenameBase}${rangeSuffix}.csv`;
    downloadCsv(filename, exportRows);
  }, [canExport, rows, from, to, openingBalance, safeFilenameBase]);

  // totals (aligned right like reports)
  const totalDebits = rows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
  const totalCredits = rows.reduce((sum, r) => sum + Number(r.credit || 0), 0);
  const closingBalance =
    rows.length > 0 ? rows[rows.length - 1].balance : openingBalance;

  const titlePrefix = selectedTenant?.title ? `${selectedTenant.title} ` : "";
  const tenantName = selectedTenant?.full_name || "";

  // Build full tenant display with unit and property
  const tenantDisplayParts = [tenantName];
  if (unitNumber) tenantDisplayParts.push(unitNumber);
  if (propertyName) tenantDisplayParts.push(propertyName);
  const tenantDisplay = tenantDisplayParts.join(", ");

  const headingPeriod =
    from && to ? `${formatDate(from)} to ${formatDate(to)}` : "";
  const statementHeading = headingPeriod
    ? `Statement for ${titlePrefix}${tenantDisplay} for ${headingPeriod}`
    : "";

  const openPrintView = useCallback(
    (autoPrint) => {
      if (typeof window === "undefined") return;

      const node = printRef?.current;
      if (!node) return;

      const clone = node.cloneNode(true);
      // Remove no-print elements (filters, buttons)
      const noPrintNodes = clone.querySelectorAll('[data-no-print="true"]');
      for (const el of noPrintNodes) el.remove();

      const escapeHtml = (str) =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const title = `Tenant Statement - ${titlePrefix}${tenantDisplay}`;

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: portrait; margin: 0.5in; }
      body { 
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; 
        margin: 20px; 
        color: #0f172a; 
        font-size: 11px; 
      }
      h1, h2, h3 { margin: 0 0 8px 0; }
      h1 { font-size: 18px; font-weight: 700; }
      h2 { font-size: 14px; font-weight: 600; }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        page-break-inside: auto; 
        margin-top: 12px;
      }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td { 
        padding: 8px 10px; 
        border-bottom: 1px solid #d1d5db; 
        vertical-align: top; 
      }
      th { 
        text-align: left; 
        color: #475569; 
        font-weight: 600; 
        background: #f1f5f9; 
        border-bottom: 2px solid #1e293b;
      }
      .text-right { text-align: right; }
      .font-medium { font-weight: 500; }
      .font-bold { font-weight: 700; }
      .statement-header {
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e5e7eb;
      }
      .statement-meta {
        font-size: 11px;
        color: #64748b;
        margin-top: 4px;
      }
      @media print {
        body { margin: 0; }
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    ${clone.innerHTML}
  </body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();

      if (autoPrint) {
        w.focus();
        setTimeout(() => {
          try {
            w.print();
          } catch (e) {
            console.error("Print failed", e);
          }
        }, 300);
      }
    },
    [titlePrefix, tenantDisplay],
  );

  return (
    <div className="mt-4" ref={printRef}>
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText
                className="w-4 h-4 text-slate-500"
                data-no-print="true"
              />
              <div className="text-sm font-semibold text-slate-800">
                Tenant statement
              </div>
            </div>
            <div className="text-xs text-slate-500" data-no-print="true">
              Debits = rent invoices + tenant deductions. Credits = payments.
            </div>
          </div>

          <div className="flex gap-2" data-no-print="true">
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              title={
                canExport
                  ? "Downloads a CSV that opens in Excel"
                  : "Pick a period with rows to export"
              }
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
            <a
              href="/payments/payment-on-account"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              <DollarSign className="w-4 h-4" />
              Pay on Account
            </a>
            <button
              type="button"
              onClick={() => openPrintView(true)}
              disabled={!canExport}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
          </div>
        </div>

        <div
          className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3"
          data-no-print="true"
        >
          <Field label="From">
            <DatePopoverInput
              value={from}
              onChange={setFrom}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
          <Field label="To">
            <DatePopoverInput
              value={to}
              onChange={setTo}
              placeholder="DD-MM-YYYY"
              className="bg-white"
            />
          </Field>
        </div>

        {statementHeading ? (
          <div className="statement-header">
            <h1>{statementHeading}</h1>
            <div className="statement-meta" data-no-print="true">
              Tenant: {titlePrefix}
              {tenantDisplay}
            </div>
          </div>
        ) : null}

        {statementQuery.isLoading ? (
          <div className="mt-3 text-sm text-slate-500">Loading statement…</div>
        ) : statementQuery.error ? (
          <div className="mt-3 text-sm text-rose-600">
            Could not load statement.
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">
            No rows in this period.
          </div>
        ) : (
          <div>
            <div className="mt-3 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Bold separator line between headers and first entry (match Reports style) */}
                  <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Receipt #</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3 text-right">Debit (UGX)</th>
                    <th className="py-2 pr-3 text-right">Credit (UGX)</th>
                    <th className="py-2 pr-3 text-right">Balance (UGX)</th>
                  </tr>
                </thead>
                <tbody>
                  {from && (
                    <tr className="border-b bg-slate-50 text-slate-500 italic">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDate(from)}
                      </td>
                      <td className="py-2 pr-3">—</td>
                      <td className="py-2 pr-3">Opening Balance</td>
                      <td className="py-2 pr-3 text-right" />
                      <td className="py-2 pr-3 text-right" />
                      <td className="py-2 pr-3 text-right font-medium">
                        {formatCurrencyUGX(openingBalance)}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, idx) => {
                    const dateText = formatDate(r.date);
                    const debitText = r.debit ? formatCurrencyUGX(r.debit) : "";
                    const creditText = r.credit
                      ? formatCurrencyUGX(r.credit)
                      : "";
                    const balanceText = formatCurrencyUGX(r.balance);
                    const receiptNumber = r.reference_number || "—";
                    const key = `${r.kind}-${idx}-${r.date}`;

                    return (
                      <tr key={key} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {dateText}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {receiptNumber}
                        </td>
                        <td className="py-2 pr-3">{r.description}</td>
                        <td className="py-2 pr-3 text-right">{debitText}</td>
                        <td className="py-2 pr-3 text-right">{creditText}</td>
                        <td className="py-2 pr-3 text-right font-medium">
                          {balanceText}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 border-slate-700">
                    <td className="py-2 pr-3 font-bold" colSpan="3">
                      Totals
                    </td>
                    <td className="py-2 pr-3 text-right font-bold">
                      {formatCurrencyUGX(totalDebits)}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold">
                      {formatCurrencyUGX(totalCredits)}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold">
                      {formatCurrencyUGX(closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* totals summary (right-aligned) - ONLY for screen view */}
            <div
              className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3"
              data-no-print="true"
            >
              <SummaryCard
                label="Debits (UGX)"
                value={formatCurrencyUGX(totalDebits)}
                align="right"
              />
              <SummaryCard
                label="Credits (UGX)"
                value={formatCurrencyUGX(totalCredits)}
                align="right"
              />
              <SummaryCard
                label="Closing (UGX)"
                value={formatCurrencyUGX(closingBalance)}
                align="right"
              />
            </div>
          </div>
        )}
      </div>
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
