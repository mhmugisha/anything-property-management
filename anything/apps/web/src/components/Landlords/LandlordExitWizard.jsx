"use client";

import {
  X,
  Check,
  ChevronRight,
  AlertTriangle,
  Circle,
  RotateCw,
  Info,
} from "lucide-react";
import { useState } from "react";
import { useCloseLandlord, useLandlordExitSummary } from "@/hooks/useLandlords";
import { useDecommissionProperty } from "@/hooks/useProperties";
import TerminationModal from "@/components/Tenants/TerminationModal";
import { formatCurrencyUGX } from "@/utils/formatCurrency";

// Landlord exit, one level above property decommission: end every lease,
// decommission every property, settle the balance, close. This chunk is the
// overview, with End lease on each lease row (step 2); steps 3 and 4 are
// shown but not yet available.
const STEPS = ["overview", "leases", "properties", "close"];
const STEP_LABELS = {
  overview: "Overview",
  leases: "End leases",
  properties: "Decommission",
  close: "Settle & close",
};
// Steps whose actions exist (inline on the overview). Settle & close only
// once the landlord is ready to close.
function availableSteps(exit) {
  return exit?.can_close === true
    ? ["leases", "properties", "close"]
    : ["leases", "properties"];
}

// Local date as yyyy-mm-dd.
function todayYMD() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Same half-cent rule as the close gate's isSettled.
const SETTLED_EPSILON = 0.005;

function StepPills({ stepIndex, available }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
              i === stepIndex
                ? "bg-[#0B1F3A] text-white"
                : available.includes(s)
                  ? "border border-[#0B1F3A] text-[#0B1F3A]"
                  : "bg-gray-100 text-slate-400"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`text-xs ${
              i === stepIndex
                ? "text-[#0B1F3A] font-medium"
                : available.includes(s)
                  ? "text-[#0B1F3A]"
                  : "text-slate-400"
            }`}
          >
            {STEP_LABELS[s]}
          </span>
          {i < STEPS.length - 1 && (
            <ChevronRight className="w-3 h-3 text-gray-300" />
          )}
        </div>
      ))}
    </div>
  );
}

function netDueLabel(net) {
  if (net > 0) return "Owed to landlord";
  if (net < 0) return "Landlord owes Exela";
  return "Settled";
}

function ChecklistItem({ state, title, detail }) {
  // state: "done" | "todo" | "blocked" | "info"
  const icon =
    state === "done" ? (
      <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
        <Check className="w-3 h-3" />
      </span>
    ) : state === "blocked" ? (
      <AlertTriangle className="w-5 h-5 text-rose-600" />
    ) : state === "info" ? (
      <Info className="w-5 h-5 text-amber-600" />
    ) : (
      <Circle className="w-5 h-5 text-amber-500" />
    );
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>
        <div
          className={`text-sm font-medium ${state === "done" ? "text-slate-500" : "text-slate-800"}`}
        >
          {title}
        </div>
        {detail && <div className="text-xs text-slate-500">{detail}</div>}
      </div>
    </li>
  );
}

function ReadinessChecklist({ exit, isEnded }) {
  const codes = exit.close_blocker_codes || [];
  const leases = exit.active_leases_count || 0;
  const live = exit.live_properties_count || 0;
  const net = Number(exit.net_due || 0);

  let balanceItem;
  if (codes.includes("negative_balance")) {
    balanceItem = (
      <ChecklistItem
        state="blocked"
        title={`Landlord owes Exela ${formatCurrencyUGX(Math.abs(net))} UGX`}
        detail="Collecting or writing off a landlord's debt is not yet supported, so this landlord can't be closed yet."
      />
    );
  } else if (net > 0) {
    balanceItem = (
      <ChecklistItem
        state="info"
        title={`Settle balance: pay ${formatCurrencyUGX(net)} UGX to the landlord`}
        detail="Paid out in full at the final close step."
      />
    );
  } else {
    balanceItem = (
      <ChecklistItem
        state="done"
        title="Balance settled"
        detail="Nothing is owed either way."
      />
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="text-sm font-semibold text-slate-800 mb-1">
        Close readiness
      </div>
      <ul className="divide-y divide-gray-50">
        <ChecklistItem
          state={codes.includes("active_leases") ? "todo" : "done"}
          title="End all tenant leases"
          detail={
            leases > 0
              ? `${leases} active lease${leases === 1 ? "" : "s"} remaining`
              : "No active leases"
          }
        />
        <ChecklistItem
          state={codes.includes("live_properties") ? "todo" : "done"}
          title="Decommission all properties"
          detail={
            live > 0
              ? `${live} propert${live === 1 ? "y" : "ies"} still live`
              : "All properties decommissioned"
          }
        />
        {balanceItem}
      </ul>
      {/* Once ended, the Settle & close panel says so instead. */}
      {isEnded ? null : exit.can_close ? (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex gap-2">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          Ready to close.
          {net > 0
            ? ` The ${formatCurrencyUGX(net)} UGX balance is paid out as part of the close.`
            : ""}
        </div>
      ) : (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <div className="font-medium mb-1">Not ready to close yet:</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {(exit.close_blockers || []).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PropertySection({
  property,
  onEndLease,
  onDecommission,
  decommissioningId,
  decommissionError,
}) {
  const leases = property.active_leases || [];
  const net = Number(property.net_due || 0);
  const canDecommission =
    !property.is_archived && property.active_lease_count === 0;
  const isDecommissioning = decommissioningId === property.property_id;
  return (
    <div className="rounded-xl border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-slate-800 truncate">
            {property.property_name}
          </span>
          {property.is_archived ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-slate-600">
              Decommissioned
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              Live
            </span>
          )}
          <span className="text-xs text-slate-500">
            {leases.length} active lease{leases.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {canDecommission && (
            <button
              type="button"
              onClick={() => onDecommission(property)}
              disabled={isDecommissioning}
              className="px-2.5 py-1 rounded-lg bg-[#0B1F3A] hover:bg-[#08172c] text-white text-xs font-medium disabled:opacity-50"
            >
              {isDecommissioning ? "Decommissioning…" : "Decommission"}
            </button>
          )}
          <div className="text-right">
            <div className="text-xs text-slate-500">{netDueLabel(net)}</div>
            <div
              className={`text-sm font-semibold ${net < 0 ? "text-rose-700" : "text-slate-800"}`}
            >
              {formatCurrencyUGX(Math.abs(net))}
            </div>
          </div>
        </div>
      </div>
      {decommissionError?.id === property.property_id && (
        <div className="px-4 pt-2 text-xs text-red-600">
          {decommissionError.msg}
        </div>
      )}
      {leases.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-500">
          No active leases.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-gray-100">
                <th className="py-2 px-4">Tenant</th>
                <th className="py-2 px-3 whitespace-nowrap">Unit</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">
                  Outstanding
                </th>
                <th className="py-2 px-3 text-right whitespace-nowrap">
                  Deposit held
                </th>
                <th className="py-2 px-3 text-right whitespace-nowrap">
                  Prepayment
                </th>
                <th className="py-2 px-3 text-right whitespace-nowrap">
                  Could reduce owed
                </th>
                <th className="py-2 px-4" />
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr key={l.lease_id} className="border-b last:border-b-0">
                  <td className="py-2 px-4 font-medium text-slate-800">
                    {l.tenant_name}
                  </td>
                  <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                    {l.unit_number || "—"}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                    {formatCurrencyUGX(l.outstanding)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                    {formatCurrencyUGX(l.deposit_held)}
                  </td>
                  <td
                    className="py-2 px-3 text-right text-slate-700 whitespace-nowrap"
                    title="Tenant-wide prepayment balance"
                  >
                    {formatCurrencyUGX(l.prepayment)}
                  </td>
                  <td
                    className="py-2 px-3 text-right whitespace-nowrap"
                    title="The most ending this lease could cut what the landlord is owed — if every unpaid invoice on it is voided at termination. Keeping an invoice (the default) or collecting it first avoids that part."
                  >
                    {Number(l.owed_reduction_ceiling || 0) > 0 ? (
                      <span className="text-amber-700">
                        up to −{formatCurrencyUGX(l.owed_reduction_ceiling)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right whitespace-nowrap">
                    {/* Also on decommissioned properties: their leases still
                        have to end before the landlord can close. */}
                    <button
                      type="button"
                      onClick={() => onEndLease(l)}
                      className="px-2.5 py-1 rounded-lg bg-[#0B1F3A] hover:bg-[#08172c] text-white text-xs font-medium"
                    >
                      End lease
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettleClosePanel({
  exit,
  landlordName,
  status,
  assetAccounts,
  closeDate,
  onCloseDateChange,
  payFromAccountId,
  onPayFromChange,
  isPending,
  closeError,
  onPayAndClose,
  onCloseLandlord,
}) {
  const net = Number(exit.net_due || 0);
  // The gate already rules out a negative balance, so "owed" means positive.
  const owed = net >= SETTLED_EPSILON;
  const owedProperties = (exit.properties || []).filter(
    (p) => Number(p.net_due || 0) > 0,
  );

  return (
    <div className="rounded-xl border border-[#0B1F3A]/20 p-4 space-y-3">
      <div className="text-sm font-semibold text-slate-800">
        Settle &amp; close
      </div>
      {status === "ended" ? (
        <div className="text-sm text-slate-600">This landlord is closed.</div>
      ) : (
        <>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Close date
            </label>
            <input
              type="date"
              value={closeDate}
              max={todayYMD()}
              onChange={(e) => onCloseDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>
          {owed ? (
            <>
              <p className="text-sm text-slate-700">
                {`Exela owes ${landlordName} ${formatCurrencyUGX(net)}. This is paid in full, then the landlord is closed.`}
              </p>
              {owedProperties.length > 0 && (
                <ul className="text-xs text-slate-600 space-y-0.5">
                  {owedProperties.map((p) => (
                    <li key={p.property_id}>
                      {`${p.property_name}: ${formatCurrencyUGX(p.net_due)}`}
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Pay from
                </label>
                <select
                  value={payFromAccountId}
                  onChange={(e) => onPayFromChange(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  <option value="">Select account…</option>
                  {(assetAccounts || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {`${a.account_code} — ${a.account_name}`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={onPayAndClose}
                disabled={!payFromAccountId || isPending}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#08172c] text-white text-sm font-medium disabled:opacity-50"
              >
                {isPending
                  ? "Closing…"
                  : `Pay ${formatCurrencyUGX(net)} & close landlord`}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                {`Nothing is owed. Closing will mark ${landlordName} as ended.`}
              </p>
              <button
                type="button"
                onClick={onCloseLandlord}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#08172c] text-white text-sm font-medium disabled:opacity-50"
              >
                {isPending ? "Closing…" : "Close landlord"}
              </button>
            </>
          )}
          {closeError && (
            <div className="text-xs text-red-600">{closeError}</div>
          )}
        </>
      )}
    </div>
  );
}

function Overview({
  exit,
  isEnded,
  settlePanel,
  onEndLease,
  onDecommission,
  decommissioningId,
  decommissionError,
}) {
  const net = Number(exit.net_due || 0);
  // Live properties first (they still need work), then decommissioned ones.
  const properties = [...(exit.properties || [])].sort(
    (a, b) => Number(a.is_archived) - Number(b.is_archived),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-slate-500">{netDueLabel(net)}</div>
          <div
            className={`text-lg font-semibold ${net < 0 ? "text-rose-700" : "text-[#0B1F3A]"}`}
          >
            {formatCurrencyUGX(Math.abs(net))} UGX
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Net due: positive = Exela owes the landlord, negative = the landlord
            owes Exela
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-slate-500">Active leases</div>
          <div className="text-lg font-semibold text-[#0B1F3A]">
            {exit.active_leases_count || 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-slate-500">Live properties</div>
          <div className="text-lg font-semibold text-[#0B1F3A]">
            {exit.live_properties_count || 0}
            <span className="text-xs font-normal text-slate-400">
              {" "}
              of {(exit.properties || []).length}
            </span>
          </div>
        </div>
      </div>

      {exit.events_match === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          The landlord statement differs from this balance by{" "}
          {formatCurrencyUGX(exit.events_difference)} UGX. Check the statement
          before closing.
        </div>
      )}

      <ReadinessChecklist exit={exit} isEnded={isEnded} />

      {exit.can_close === true && settlePanel}

      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-800">Properties</div>
        {(exit.active_leases_count || 0) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <Info className="w-4 h-4 shrink-0" />
            Voiding a tenant&apos;s unpaid invoices at termination reduces what
            this landlord is owed. &apos;Could reduce owed&apos; is the most
            each lease could cut if all its unpaid invoices are voided — keeping
            or collecting them avoids it. The &apos;Owed to landlord&apos;
            figure updates after each lease ends.
          </div>
        )}
        {properties.length === 0 ? (
          <div className="text-sm text-slate-500">
            This landlord has no properties.
          </div>
        ) : (
          properties.map((p) => (
            <PropertySection
              key={p.property_id}
              property={p}
              onEndLease={onEndLease}
              onDecommission={onDecommission}
              decommissioningId={decommissioningId}
              decommissionError={decommissionError}
            />
          ))
        )}
        <p className="text-xs text-slate-400">Amounts in UGX.</p>
      </div>
    </div>
  );
}

export function LandlordExitWizard({ landlordId, landlordName, onClose }) {
  // No saved progress: every open (and every refresh) reads live state.
  const summaryQuery = useLandlordExitSummary(landlordId, true);
  const summaryData = summaryQuery.data;
  const exit = summaryData?.exit || null;
  const status = summaryData?.landlord?.status;
  const stepIndex = 0;
  // The lease being ended: { tenant_id, lease_id, tenant_name, ... }.
  const [endingLease, setEndingLease] = useState(null);
  const decommissionMutation = useDecommissionProperty();
  const [decommissioningId, setDecommissioningId] = useState(null);
  // { id, msg } for the property whose decommission failed.
  const [decommissionError, setDecommissionError] = useState(null);

  function onDecommission(property) {
    const ok = window.confirm(
      `Decommission ${property.property_name}? No new rent invoices will be generated, it will be hidden from the property list, and its units can't take new leases. History is kept and you can reactivate it later.`,
    );
    if (!ok) return;
    setDecommissionError(null);
    setDecommissioningId(property.property_id);
    decommissionMutation.mutate(property.property_id, {
      onSuccess: () => {
        setDecommissioningId(null);
        // The decommission hook doesn't refresh landlord queries.
        summaryQuery.refetch();
      },
      onError: (e) => {
        setDecommissionError({
          id: property.property_id,
          msg: e?.message || "Could not decommission this property.",
        });
        setDecommissioningId(null);
        // Resync after a 409, same as DecommissionModal.
        summaryQuery.refetch();
      },
    });
  }

  const closeMutation = useCloseLandlord();
  const [closeDate, setCloseDate] = useState(todayYMD);
  const [payFromAccountId, setPayFromAccountId] = useState("");
  const [closeError, setCloseError] = useState(null);

  function runClose(payload) {
    setCloseError(null);
    closeMutation.mutate(
      { landlordId, payload },
      {
        onSuccess: () => summaryQuery.refetch(),
        onError: (e) =>
          setCloseError(e?.message || "Could not close this landlord."),
      },
    );
  }

  function onPayAndClose() {
    const net = Number(exit?.net_due || 0);
    if (
      !window.confirm(
        `This will pay ${formatCurrencyUGX(net)} to ${landlordName} and permanently mark them as ended. Continue?`,
      )
    )
      return;
    runClose({
      termination_date: closeDate,
      balance_settlement: {
        payout_amount: net,
        payout_account_id: Number(payFromAccountId),
        transaction_date: closeDate,
      },
    });
  }

  function onCloseLandlord() {
    if (
      !window.confirm(
        `This will permanently mark ${landlordName} as ended. Continue?`,
      )
    )
      return;
    runClose({ termination_date: closeDate, balance_settlement: null });
  }

  const updatedAt = summaryQuery.dataUpdatedAt
    ? new Date(summaryQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Landlord Exit
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {landlordName}
                {status && status !== "active" && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-slate-600 capitalize">
                    {status}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => summaryQuery.refetch()}
                disabled={summaryQuery.isFetching}
                title={updatedAt ? `Updated ${updatedAt}` : "Refresh"}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400 disabled:opacity-50"
              >
                <RotateCw
                  className={`w-4 h-4 ${summaryQuery.isFetching ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <StepPills stepIndex={stepIndex} available={availableSteps(exit)} />

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[200px]">
            {summaryQuery.isLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Loading landlord exit summary…
              </div>
            ) : summaryQuery.isError || !exit ? (
              <div className="text-sm text-red-600">
                Failed to load the landlord exit summary.
              </div>
            ) : (
              <Overview
                exit={exit}
                isEnded={status === "ended"}
                settlePanel={
                  <SettleClosePanel
                    exit={exit}
                    landlordName={landlordName}
                    status={status}
                    assetAccounts={summaryData?.asset_accounts}
                    closeDate={closeDate}
                    onCloseDateChange={setCloseDate}
                    payFromAccountId={payFromAccountId}
                    onPayFromChange={setPayFromAccountId}
                    isPending={closeMutation.isPending}
                    closeError={closeError}
                    onPayAndClose={onPayAndClose}
                    onCloseLandlord={onCloseLandlord}
                  />
                }
                onEndLease={(l) => setEndingLease(l)}
                onDecommission={onDecommission}
                decommissioningId={decommissioningId}
                decommissionError={decommissionError}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <span className="text-xs text-slate-400">
              {updatedAt ? `Live data · updated ${updatedAt}` : ""}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#08172c] text-white text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Rendered after the wizard so it layers on top (both are z-50). */}
      {endingLease && (
        <TerminationModal
          tenantId={endingLease.tenant_id}
          leaseId={endingLease.lease_id}
          tenantName={endingLease.tenant_name}
          onClose={() => setEndingLease(null)}
          onSuccess={() => {
            setEndingLease(null);
            // The end-lease hook doesn't refresh landlord queries.
            summaryQuery.refetch();
          }}
        />
      )}
    </>
  );
}
