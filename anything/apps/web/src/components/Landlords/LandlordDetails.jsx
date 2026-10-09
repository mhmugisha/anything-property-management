import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Save,
  Archive,
  RotateCcw,
  Ban,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import { PropertiesCard } from "./PropertiesCard";
import { PayoutCard } from "./PayoutCard";
import { StatementCard } from "./StatementCard";
import { ordinalDay, monthLabelFromRange } from "@/utils/formatters";
import { formatDate } from "@/utils/formatDate";

export function LandlordDetails({
  landlord,
  properties,
  propertiesLoading,
  selectedPropertyId,
  onSelectProperty,
  onEdit,
  payoutDate,
  payoutAmount,
  payoutMethod,
  payoutRef,
  onPayoutDateChange,
  onPayoutAmountChange,
  onPayoutMethodChange,
  onPayoutRefChange,
  onRecordPayout,
  payoutSaving,
  payoutError,
  payoutSuccess,
  from,
  to,
  onFromChange,
  onToChange,
  statementLoading,
  statementError,
  statementRows,
  statementSummary,
  canReports,
  // read-only actions
  onArchive,
  onReactivate,
  onEndLeases,
  onDelete,
  isArchiving,
  isReactivating,
  isEndingLeases,
  isDeleting,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreMenu]);

  const landlordHeading = landlord
    ? `${landlord.title ? `${landlord.title} ` : ""}${landlord.full_name || ""}`
    : "";

  const status = landlord?.status || "active";
  const isInactive = status !== "active";
  const statusLabel =
    status === "archived" ? "Archived" : status === "ended" ? "Ended" : "";

  const selectedProperty = properties.find(
    (p) => String(p.id) === String(selectedPropertyId),
  );
  const propertyHeading = selectedProperty?.property_name || "";

  const monthLabel = monthLabelFromRange(from, to);
  const monthHeading = monthLabel ? `${monthLabel} Statement` : "Statement";

  const statementHeadingText =
    landlordHeading && propertyHeading
      ? `${monthHeading} for ${landlordHeading} for ${propertyHeading}`
      : "";

  const dueText = landlord?.due_day
    ? `${ordinalDay(landlord.due_day)} every month`
    : "—";

  const phoneText = landlord?.phone || "";
  const emailText = landlord?.email || "";

  const contractStartText = landlord?.start_date
    ? formatDate(landlord.start_date)
    : "—";
  const contractEndText = landlord?.end_date
    ? formatDate(landlord.end_date)
    : "—";

  const paymentMethodText = landlord?.payment_method
    ? String(landlord.payment_method).replace(/_/g, " ")
    : "—";

  const bankNameText = landlord?.bank_name || "—";
  const bankAccountTitleText = landlord?.bank_account_title || "—";
  const bankAccountNumberText = landlord?.bank_account_number || "—";

  const mobileMoneyNameText = landlord?.mobile_money_name || "—";
  const mobileMoneyPhoneText = landlord?.mobile_money_phone || "—";

  const archiveLabel = isArchiving ? "Archiving…" : "Archive";
  const reactivateLabel = isReactivating ? "Reactivating…" : "Reactivate";
  const endLeasesLabel = isEndingLeases ? "Ending…" : "End Lease";
  const deleteLabel = isDeleting ? "Deleting…" : "Delete";

  const toggleDetailsLabel = showDetails ? "Hide Details" : "View Details";
  const toggleDetailsIcon = showDetails ? EyeOff : Eye;
  const ToggleDetailsIcon = toggleDetailsIcon;

  const actionsDisabled =
    isDeleting || isArchiving || isReactivating || isEndingLeases;

  const canOpenPaymentNote =
    canReports === true && !!landlord?.id && !!selectedPropertyId;

  const paymentNoteUrl = useMemo(() => {
    if (!canOpenPaymentNote) return "";
    const params = new URLSearchParams();
    params.set("landlordId", String(landlord.id));
    params.set("propertyId", String(selectedPropertyId));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/reports/payment-note?${params.toString()}`;
  }, [canOpenPaymentNote, landlord?.id, selectedPropertyId, from, to]);

  const openPaymentNote = useCallback(() => {
    if (!canOpenPaymentNote) return;
    if (typeof window === "undefined") return;
    window.open(paymentNoteUrl, "_blank", "noopener,noreferrer");
  }, [canOpenPaymentNote, paymentNoteUrl]);

  const paymentNoteLabel = canOpenPaymentNote
    ? "Payment Note"
    : "Select A Property To Create Payment Note";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-slate-800">
            {landlordHeading}
          </div>
          {phoneText ? (
            <div className="text-sm text-slate-500">{phoneText}</div>
          ) : null}
          {emailText ? (
            <div className="text-sm text-slate-500">{emailText}</div>
          ) : null}
          <div className="text-sm text-slate-500">Due Day: {dueText}</div>
          <div className="text-sm text-slate-500">
            Contract: {contractStartText} → {contractEndText}
          </div>
          {isInactive ? (
            <div className="text-xs text-slate-500 mt-1">{statusLabel}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={onEdit}
            disabled={actionsDisabled}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Edit
          </button>

          <button
            onClick={() => setShowDetails((v) => !v)}
            disabled={actionsDisabled}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700 disabled:opacity-50"
          >
            <ToggleDetailsIcon className="w-4 h-4" />
            {toggleDetailsLabel}
          </button>

          {/* More dropdown button */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
            >
              <MoreVertical className="w-4 h-4" />
              More
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  onClick={() => {
                    onEndLeases();
                    setShowMoreMenu(false);
                  }}
                  disabled={isInactive || isEndingLeases || isDeleting}
                  title={isInactive ? "This landlord is ended/archived" : ""}
                  className="w-full text-left px-4 py-2 hover:bg-amber-50 flex items-center gap-2 text-amber-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-t-lg"
                >
                  <Ban className="w-4 h-4" />
                  {endLeasesLabel}
                </button>

                <button
                  onClick={() => {
                    onDelete();
                    setShowMoreMenu(false);
                  }}
                  disabled={actionsDisabled}
                  className="w-full text-left px-4 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDetails ? (
        <div className="mt-4 rounded-xl border border-gray-100 bg-slate-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Payment Method
              </div>
              <div className="text-sm text-slate-800">{paymentMethodText}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Bank Name
              </div>
              <div className="text-sm text-slate-800">{bankNameText}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Bank Account Title
              </div>
              <div className="text-sm text-slate-800">
                {bankAccountTitleText}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Bank Account Number
              </div>
              <div className="text-sm text-slate-800">
                {bankAccountNumberText}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Mobile Money Name
              </div>
              <div className="text-sm text-slate-800">
                {mobileMoneyNameText}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Mobile Money Phone
              </div>
              <div className="text-sm text-slate-800">
                {mobileMoneyPhoneText}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <PropertiesCard
          properties={properties}
          isLoading={propertiesLoading}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={onSelectProperty}
        />

        <PayoutCard
          payoutDate={payoutDate}
          payoutAmount={payoutAmount}
          payoutMethod={payoutMethod}
          payoutRef={payoutRef}
          onPayoutDateChange={onPayoutDateChange}
          onPayoutAmountChange={onPayoutAmountChange}
          onPayoutMethodChange={onPayoutMethodChange}
          onPayoutRefChange={onPayoutRefChange}
          onRecordPayout={onRecordPayout}
          isPropertySelected={!!selectedPropertyId}
          isSaving={payoutSaving}
          error={payoutError}
          success={payoutSuccess}
          onOpenPaymentNote={openPaymentNote}
          paymentNoteDisabled={actionsDisabled || !canOpenPaymentNote}
          paymentNoteTitle={paymentNoteLabel}
        />
      </div>

      <StatementCard
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onPropertyChange={onSelectProperty}
        from={from}
        to={to}
        onFromChange={onFromChange}
        onToChange={onToChange}
        statementHeading={statementHeadingText}
        isLoading={statementLoading}
        error={statementError}
        rows={statementRows}
        summary={statementSummary}
        canReports={canReports}
      />
    </div>
  );
}
