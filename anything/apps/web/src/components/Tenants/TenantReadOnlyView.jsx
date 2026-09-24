import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
  const autoRangeAppliedRef = useRef(null);
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

  useEffect(() => {
    autoRangeAppliedRef.current = null;
  }, [selectedTenant?.id]);

  // Terminated tenants have no current-month activity, so the default
  // month range would show an empty statement. Widen to full history once
  // per tenant; manual date changes afterwards are left alone.
  useEffect(() => {
    if (!statement || !selectedTenant?.id) return;
    if (autoRangeAppliedRef.current === selectedTenant.id) return;

    const leasesList = statement.leases || [];
    if (leasesList.length === 0) return;

    const sorted = [...leasesList].sort((a, b) =>
      String(b.start_date || "").localeCompare(String(a.start_date || "")),
    );
    const latest = sorted[0];

    console.log("auto-range debug", {
      tenantId: selectedTenant?.id,
      leasesCount: leasesList.length,
      latestStatus: latest?.status,
      latestStart: latest?.start_date,
      alreadyApplied: autoRangeAppliedRef.current,
    });

    if (latest && latest.status === "ended") {
      const startYmd = latest.start_date
        ? String(latest.start_date).slice(0, 10)
        : null;
      const todayYmd = new Date().toISOString().slice(0, 10);
      if (startYmd) {
        setFrom(startYmd);
        setTo(todayYmd);
      }
      autoRangeAppliedRef.current = selectedTenant.id;
    }
  }, [statement, selectedTenant?.id]);
  const invoices = statement?.invoices || [];
  const payments = statement?.payments || [];
  const deductions = statement?.deductions || [];
  const voidedInvoices = statement?.voidedInvoices || [];
  const leases = statement?.leases || [];
  const isEndedLease = useMemo(() => {
    const list = statement?.leases || [];
    if (list.length === 0) return false;
    const sorted = [...list].sort((a, b) =>
      String(b.start_date || "").localeCompare(String(a.start_date || ""))
    );
    return sorted[0]?.status === "ended";
  }, [statement]);
  const openingBalance = Number(statement?.openingBalance ?? 0);
  const unitNumber = leases[0]?.unit_number || null;
  const propertyName = leases[0]?.property_name || null;

  // Merge invoices, payments, deductions into flat rows filtered by from/to,
  // sorted by (date, id) so same-day rows have a stable, reproducible order
  // and the running balance is identical on every render.
  const mergedRows = useMemo(() => {
    const kindOrder = { invoice: 0, payment: 1, deduction: 2 };
    const all = [
      ...invoices.map((i) => ({
        id: Number(i.id) || 0,
        date: i.invoice_date ? String(i.invoice_date).slice(0, 10) : "",
        reference_number: "",
        description: i.description || `Invoice #${i.id}`,
        debit: Number(i.amount || 0),
        credit: 0,
        kind: "invoice",
      })),
      ...payments.map((p) => ({
        id: Number(p.id) || 0,
        date: p.payment_date ? String(p.payment_date).slice(0, 10) : "",
        reference_number: p.reference_number || "",
        description: (() => {
          const method = p.payment_method || "";
          const ref = p.reference_number ? ` (${p.reference_number})` : "";
          const invoice = p.invoice_description ? ` - ${p.invoice_description}` : "";
          const methodPart = method ? `Payment - ${method}${ref}` : `Payment${ref}`;
          return `${methodPart}${invoice}`;
        })(),
        debit: 0,
        credit: Number(p.invoice_amount_applied || 0),
        kind: "payment",
      })),
      ...deductions.map((d) => ({
        id: Number(d.id) || 0,
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

    all.sort((a, b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      if (d !== 0) return d;
      const k = (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99);
      if (k !== 0) return k;
      return (a.id || 0) - (b.id || 0);
    });
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

      const escapeHtml = (str) =>
        String(str ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const dash = "&mdash;";
      const money = (n) => escapeHtml(formatCurrencyUGX(Number(n) || 0));

      const tenantFull = `${titlePrefix}${tenantName}`.trim();
      const title = `Tenant Statement - ${tenantFull}`;
      const todayYmd = new Date().toISOString().slice(0, 10);

      // Reconciliation: openingBalance + totalDebits - totalCredits === closingBalance,
      // which equals the last row's running balance and the Outstanding Balance below.
      const totalCharges = totalDebits;
      const totalPayments = totalCredits;
      const outstandingBalance = closingBalance;

      const openingRowHtml = from
        ? `<tr class="opening">
            <td>${escapeHtml(formatDate(from))}</td>
            <td>Opening Balance</td>
            <td class="center">${dash}</td>
            <td class="right">${dash}</td>
            <td class="right">${dash}</td>
            <td class="right bal">${money(openingBalance)}</td>
          </tr>`
        : "";

      const bodyRowsHtml = rows
        .map((r) => {
          const debitCell = r.debit ? money(r.debit) : dash;
          const creditCell = r.credit ? money(r.credit) : dash;
          const refCell = r.reference_number
            ? escapeHtml(r.reference_number)
            : dash;
          return `<tr>
            <td>${escapeHtml(formatDate(r.date))}</td>
            <td>${escapeHtml(r.description || "")}</td>
            <td class="center">${refCell}</td>
            <td class="right">${debitCell}</td>
            <td class="right">${creditCell}</td>
            <td class="right bal">${money(r.balance)}</td>
          </tr>`;
        })
        .join("");

      const totalRowHtml = `
        <tr class="total-row">
          <td colspan="3" class="right">TOTAL</td>
          <td class="right">${money(totalDebits)}</td>
          <td class="right">${money(totalCredits)}</td>
          <td class="right">${money(closingBalance)}</td>
        </tr>`;

      const detailsCells = [
        { label: "Property", value: propertyName || dash, isHtml: propertyName ? false : true },
        { label: "Unit", value: unitNumber || dash, isHtml: unitNumber ? false : true },
        {
          label: "Statement Period",
          value:
            from && to ? `${formatDate(from)} – ${formatDate(to)}` : dash,
          isHtml: from && to ? false : true,
        },
        { label: "Statement Date", value: formatDate(todayYmd), isHtml: false },
      ]
        .map(
          (c) => `
        <div class="details-cell">
          <div class="details-label">${escapeHtml(c.label)}</div>
          <div class="details-value">${c.isHtml ? c.value : escapeHtml(c.value)}</div>
        </div>`,
        )
        .join("");

      const summaryCells = `
        <div class="summary-cell">
          <div class="summary-label">Opening Balance</div>
          <div class="summary-value">${money(openingBalance)}</div>
        </div>
        <div class="summary-cell">
          <div class="summary-label">Total Charges</div>
          <div class="summary-value">${money(totalCharges)}</div>
        </div>
        <div class="summary-cell">
          <div class="summary-label">Total Payments</div>
          <div class="summary-value">${money(totalPayments)}</div>
        </div>
        <div class="summary-cell outstanding">
          <div class="summary-label">Outstanding Balance</div>
          <div class="summary-value">${money(outstandingBalance)}</div>
        </div>`;

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --navy: #1a2b4a;
        --navy-dark: #0f1d36;
        --gold: #c9a227;
        --gold-soft: #f2e6bf;
        --ink: #0f172a;
        --muted: #64748b;
        --line: #d9dee7;
        --zebra: #f7f8fb;
      }
      @page { size: A4; margin: 0.5in; }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
          Roboto, Helvetica, Arial, sans-serif;
        color: var(--ink);
        font-size: 11px;
        line-height: 1.4;
      }

      /* Header */
      .header {
        text-align: center;
        padding: 4px 0 14px 0;
        border-bottom: 3px solid var(--gold);
        margin-bottom: 14px;
      }
      .header .brand-accent {
        display: inline-block;
        width: 64px;
        height: 3px;
        background: var(--gold);
        margin-bottom: 10px;
      }
      .header .title {
        color: var(--navy);
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 4px;
        margin: 0;
      }
      .header .tenant {
        color: var(--navy);
        font-size: 13px;
        font-weight: 600;
        margin-top: 6px;
        letter-spacing: 0.5px;
      }

      /* Details strip */
      .details {
        display: table;
        width: 100%;
        table-layout: fixed;
        background: #f4f6fb;
        border: 1px solid var(--line);
        border-radius: 4px;
        margin-bottom: 16px;
      }
      .details-cell {
        display: table-cell;
        padding: 10px 12px;
        border-right: 1px solid var(--line);
        vertical-align: top;
      }
      .details-cell:last-child { border-right: none; }
      .details-label {
        text-transform: uppercase;
        font-size: 9px;
        letter-spacing: 1px;
        color: var(--muted);
        margin-bottom: 4px;
      }
      .details-value {
        color: var(--navy);
        font-weight: 600;
        font-size: 11.5px;
      }

      /* Section header bars */
      .section-bar {
        background: var(--navy);
        color: #fff;
        padding: 7px 12px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        border-radius: 3px 3px 0 0;
        margin-top: 4px;
      }

      /* Transaction table */
      table.txn {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
        border: 1px solid var(--line);
        border-top: none;
        margin-bottom: 16px;
      }
      table.txn thead { display: table-header-group; }
      table.txn tfoot { display: table-row-group; }
      table.txn tr { page-break-inside: avoid; page-break-after: auto; }
      table.txn th, table.txn td {
        padding: 7px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      table.txn thead th {
        background: #eef1f7;
        color: var(--navy);
        text-align: left;
        font-weight: 700;
        font-size: 10px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        border-bottom: 2px solid var(--navy);
      }
      table.txn th.right, table.txn td.right { text-align: right; }
      table.txn th.center, table.txn td.center { text-align: center; }
      table.txn tbody tr:nth-child(even) { background: var(--zebra); }
      table.txn tbody tr.opening {
        background: #eef2fa;
        color: var(--navy);
        font-style: italic;
      }
      table.txn td.bal { font-weight: 600; color: var(--navy); }
      table.txn tfoot tr.total-row td {
        background: var(--navy);
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 1px;
        border-bottom: none;
      }

      /* Account summary */
      .summary {
        display: table;
        width: 100%;
        table-layout: fixed;
        border: 1px solid var(--line);
        border-top: none;
        margin-bottom: 16px;
      }
      .summary-cell {
        display: table-cell;
        padding: 12px 14px;
        border-right: 1px solid var(--line);
        vertical-align: top;
      }
      .summary-cell:last-child { border-right: none; }
      .summary-label {
        text-transform: uppercase;
        font-size: 9px;
        letter-spacing: 1px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .summary-value {
        color: var(--navy);
        font-weight: 700;
        font-size: 14px;
      }
      .summary-cell.outstanding {
        background: var(--gold);
      }
      .summary-cell.outstanding .summary-label {
        color: var(--navy-dark);
      }
      .summary-cell.outstanding .summary-value {
        color: var(--navy-dark);
      }

      /* Footer */
      .footer-note {
        background: var(--navy);
        color: #fff;
        text-align: center;
        padding: 9px 12px;
        font-size: 10px;
        letter-spacing: 2px;
        font-weight: 600;
        border-radius: 3px;
        page-break-inside: avoid;
      }

      @media print {
        a { color: inherit; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand-accent"></div>
      <div class="title">TENANT STATEMENT</div>
      <div class="tenant">${escapeHtml(tenantFull || "")}</div>
    </div>

    <div class="details">
      ${detailsCells}
    </div>

    <div class="section-bar">Transaction History</div>
    <table class="txn">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th class="center">Reference</th>
          <th class="right">Debit (UGX)</th>
          <th class="right">Credit (UGX)</th>
          <th class="right">Balance (UGX)</th>
        </tr>
      </thead>
      <tbody>
        ${openingRowHtml}
        ${bodyRowsHtml}
      </tbody>
      <tfoot>
        ${totalRowHtml}
      </tfoot>
    </table>

    <div class="section-bar">Account Summary</div>
    <div class="summary">
      ${summaryCells}
    </div>

    <div class="footer-note">
      PLEASE ENSURE THAT ALL OUTSTANDING BALANCES ARE CLEARED BY THE DUE DATE.
    </div>
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
    [
      titlePrefix,
      tenantName,
      propertyName,
      unitNumber,
      from,
      to,
      openingBalance,
      rows,
      totalDebits,
      totalCredits,
      closingBalance,
    ],
  );

  return (
    <div className={`mt-4 ${isEndedLease ? "text-slate-400" : ""}`} ref={printRef}>
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
              {isEndedLease && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  ENDED — read only
                </span>
              )}
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

            {voidedInvoices.length > 0 && (
              <div className="mt-6 border-t border-dashed border-amber-300 pt-4">
                <div className="text-sm font-semibold text-amber-700 mb-2">
                  Voided at Termination (for reference — not included in balance)
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1">Period</th>
                      <th className="py-1">Description</th>
                      <th className="py-1 text-right">Original Amount</th>
                      <th className="py-1 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidedInvoices.map((v) => (
                      <tr key={v.id} className="text-slate-400 line-through">
                        <td className="py-1">
                          {v.invoice_month}/{v.invoice_year}
                        </td>
                        <td className="py-1">{v.description}</td>
                        <td className="py-1 text-right">
                          {formatCurrencyUGX(Number(v.amount) || 0)}
                        </td>
                        <td className="py-1 text-right no-underline">
                          VOIDED
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
