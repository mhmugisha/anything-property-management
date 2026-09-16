import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/utils/api";
import { formatCurrencyUGX } from "@/utils/formatCurrencyUGX";
import DatePopoverInput from "@/components/DatePopoverInput";
import PrintPreviewButtons from "@/components/PrintPreviewButtons";
import { useManagerArrearsReport } from "@/hooks/useReports";
import {
  useLatestPromises,
  useCreatePromise,
  useUpdatePromise,
} from "@/hooks/usePaymentPromises";

const numberFormatter = new Intl.NumberFormat("en-US");
const fmtNum = (n) => numberFormatter.format(Number(n || 0));

function fmtPercent(n) {
  const v = Number(n || 0);
  return `${v.toFixed(v >= 100 || v < 10 ? 1 : 2)}%`;
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}-${m}-${y}`;
}

function formatShortDate(iso) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return s;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function truncate(text, max = 32) {
  const s = String(text || "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function ManagerArrearsReport({ userLoading, user, canViewReports }) {
  const printRef = useRef(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const officersQuery = useQuery({
    queryKey: ["lookups", "officers"],
    queryFn: async () => {
      const data = await fetchJson("/api/lookups/officers");
      return data.officers || [];
    },
    enabled: !userLoading && !!user && canViewReports,
  });
  const officers = officersQuery.data || [];

  const reportQuery = useManagerArrearsReport(
    { fromDate, toDate, officerId: selectedOfficerId },
    !userLoading && !!user && canViewReports,
  );

  const data = reportQuery.data;
  const managers = data?.managers || [];
  const summary = data?.summary || {
    total_rent: 0,
    recovered: 0,
    balance: 0,
    recovery_rate: 0,
  };
  const grandTotal = Number(data?.grand_total_balance || 0);

  const officerLabel = useMemo(() => {
    if (!selectedOfficerId) return "All Managers";
    if (selectedOfficerId === "unassigned") return "Unassigned";
    const found = officers.find(
      (o) => String(o.id) === String(selectedOfficerId),
    );
    return found ? found.full_name : "—";
  }, [selectedOfficerId, officers]);

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) {
      return `${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}`;
    }
    if (fromDate) return `From ${formatDateDisplay(fromDate)}`;
    if (toDate) return `Until ${formatDateDisplay(toDate)}`;
    return "All Dates";
  }, [fromDate, toDate]);

  const reportTitle = "Manager Arrears";
  const hasRows = managers.some((m) =>
    m.properties.some((p) => p.rows.length > 0),
  );

  const tenantIds = useMemo(() => {
    const set = new Set();
    for (const m of managers) {
      for (const p of m.properties) {
        for (const r of p.rows) {
          if (r.tenant_id != null) set.add(Number(r.tenant_id));
        }
      }
    }
    return Array.from(set);
  }, [managers]);

  const latestPromisesQuery = useLatestPromises(tenantIds, tenantIds.length > 0);
  const latestByTenant = latestPromisesQuery.data || {};

  const [editor, setEditor] = useState(null);
  const openEditor = (tenantId, tenantName, existing) => {
    setEditor({ tenantId: Number(tenantId), tenantName, existing: existing || null });
  };
  const closeEditor = () => setEditor(null);

  return (
    <div ref={printRef}>
      {/* Report header */}
      <div className="report-header bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 text-center">
        <h1 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
          {reportTitle}
        </h1>
        <div className="mt-2 flex flex-col items-center gap-1 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Portfolio Manager:</span>{" "}
            {officerLabel}
          </div>
          <div>
            <span className="font-medium text-slate-700">Date Range:</span>{" "}
            {dateRangeLabel}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
        data-no-print="true"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              From Date
            </label>
            <DatePopoverInput
              value={fromDate}
              onChange={setFromDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              To Date
            </label>
            <DatePopoverInput
              value={toDate}
              onChange={setToDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Portfolio Manager
            </label>
            <select
              value={selectedOfficerId}
              onChange={(e) => setSelectedOfficerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            >
              <option value="">All Managers</option>
              <option value="unassigned">Unassigned</option>
              {officers.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary chips + Print/PDF (one row) */}
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <SummaryBox label="Total Rent" value={formatCurrencyUGX(summary.total_rent)} />
          <SummaryBox label="Recovered" value={formatCurrencyUGX(summary.recovered)} />
          <SummaryBox label="Balance" value={formatCurrencyUGX(summary.balance)} />
          <SummaryBox label="Recovery Rate" value={fmtPercent(summary.recovery_rate)} />
        </div>
        <div data-no-print="true">
          <PrintPreviewButtons targetRef={printRef} title={reportTitle} />
        </div>
      </div>

      {/* Main table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        {reportQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading report…</p>
        ) : reportQuery.error ? (
          <p className="text-sm text-rose-600">
            {reportQuery.error.message || "Could not load report."}
          </p>
        ) : !hasRows ? (
          <p className="text-sm text-slate-500">
            No arrears found with the current filters.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b-2 border-slate-700">
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3">Tenant</th>
                  <th className="py-2 px-3 text-right">Days</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                  <th className="py-2 px-3">Latest Promise</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => {
                  const managerKey =
                    m.officer_id === null ? "unassigned" : m.officer_id;
                  return (
                    <Fragment key={managerKey}>
                      {/* Manager section header */}
                      <tr className="bg-slate-800 text-white">
                        <td
                          colSpan={3}
                          className="py-2 px-3 font-semibold uppercase tracking-wide text-xs"
                        >
                          {m.officer_name}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {formatCurrencyUGX(m.total_balance)}
                        </td>
                        <td className="py-2 px-3" />
                      </tr>

                      {m.properties.map((p) => {
                        const propertyKey =
                          p.property_id === null ? "none" : p.property_id;
                        return (
                          <Fragment key={`${managerKey}-${propertyKey}`}>
                            {p.rows.map((r) => {
                              const promise =
                                r.tenant_id != null
                                  ? latestByTenant[Number(r.tenant_id)]
                                  : null;
                              return (
                                <tr
                                  key={r.invoice_id}
                                  className="border-b border-slate-100 hover:bg-slate-50"
                                >
                                  <td className="py-2 px-3 text-slate-800">
                                    {r.unit_number}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700">
                                    {r.tenant_name}
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-700">
                                    {fmtNum(r.days_overdue)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium text-slate-900">
                                    {formatCurrencyUGX(r.balance)}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700">
                                    <PromiseCell
                                      promise={promise}
                                      onClick={() =>
                                        openEditor(
                                          r.tenant_id,
                                          r.tenant_name,
                                          promise,
                                        )
                                      }
                                      disabled={r.tenant_id == null}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Property subtotal divider */}
                            <tr className="bg-slate-50 border-t border-slate-300">
                              <td
                                colSpan={3}
                                className="py-2 px-3 font-semibold text-slate-700"
                              >
                                {p.property_name} Subtotal
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                {formatCurrencyUGX(p.subtotal_balance)}
                              </td>
                              <td className="py-2 px-3" />
                            </tr>
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* Grand total */}
                <tr className="border-t-2 border-b-2 border-slate-700 bg-slate-50">
                  <td
                    colSpan={3}
                    className="py-3 px-3 font-bold text-slate-900"
                  >
                    Total Balance
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrencyUGX(grandTotal)}
                  </td>
                  <td className="py-3 px-3" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor ? (
        <PromiseEditor
          tenantId={editor.tenantId}
          tenantName={editor.tenantName}
          existing={editor.existing}
          onClose={closeEditor}
        />
      ) : null}
    </div>
  );
}

function PromiseCell({ promise, onClick, disabled }) {
  if (disabled) {
    return <span className="text-slate-400">—</span>;
  }
  if (!promise) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
        data-no-print="true"
      >
        + Add promise
      </button>
    );
  }
  const dateLabel = formatShortDate(promise.promise_date);
  const amountLabel =
    promise.amount != null ? formatCurrencyUGX(promise.amount) : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left leading-tight text-xs group"
      title={promise.comment || ""}
    >
      <div className="text-slate-800 group-hover:text-indigo-700">
        {truncate(promise.comment, 32)}
      </div>
      <div className="text-slate-500">
        {dateLabel}
        {amountLabel ? ` · ${amountLabel}` : ""}
      </div>
    </button>
  );
}

function PromiseEditor({ tenantId, tenantName, existing, onClose }) {
  const isEdit = Boolean(existing?.id);
  const [comment, setComment] = useState(existing?.comment || "");
  const [promiseDate, setPromiseDate] = useState(
    existing?.promise_date ? String(existing.promise_date).slice(0, 10) : "",
  );
  const [amount, setAmount] = useState(
    existing?.amount != null ? String(existing.amount) : "",
  );
  const [error, setError] = useState("");

  const createMut = useCreatePromise();
  const updateMut = useUpdatePromise();
  const saving = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    setError("");
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setError("Comment is required.");
      return;
    }
    if (!promiseDate) {
      setError("Promise date is required.");
      return;
    }
    let amountValue = null;
    if (amount !== "" && amount !== null && amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Amount must be a positive number.");
        return;
      }
      amountValue = n;
    }
    const payload = {
      tenant_id: tenantId,
      promise_date: promiseDate,
      comment: trimmedComment,
      amount: amountValue,
    };
    const opts = {
      onSuccess: () => onClose(),
      onError: (err) => setError(err?.message || "Failed to save promise."),
    };
    if (isEdit) {
      updateMut.mutate({ id: existing.id, payload }, opts);
    } else {
      createMut.mutate(payload, opts);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-no-print="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">
            {isEdit ? "Edit Payment Promise" : "New Payment Promise"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{tenantName}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Comment <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Promised to pay by end of week"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Promise Date <span className="text-rose-500">*</span>
            </label>
            <DatePopoverInput
              value={promiseDate}
              onChange={setPromiseDate}
              placeholder="DD-MM-YYYY"
              className="bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Amount (optional)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500000"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none text-sm"
            />
          </div>

          {error ? (
            <p className="text-xs text-rose-600">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
      <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
