import {
  Archive,
  Save,
  Trash2,
  RotateCcw,
  Ban,
  DoorOpen,
  MoreVertical,
  Eye,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { TenantForm } from "./TenantForm";
import { LeaseForm } from "./LeaseForm";

export function TenantDetails({
  isCreating,
  isEditing,
  tenantForm,
  leaseForm,
  onTenantFormChange,
  onLeaseFormChange,
  onLandlordChange,
  onPropertyChange,
  onUnitChange,
  landlordOptions,
  propertyOptions,
  unitOptions,
  onSave,
  onCancel,
  isSaving,
  error,
  canSave,
  detailTitle,
  detailSubtitle,
  onStartEdit,
  showEditButton,
  selectedTenantId,
  // read-only actions
  isArchived,
  canEndLease,
  canOpenLease,
  onArchive,
  onReactivate,
  onEndLease,
  onOpenLease,
  onDelete,
  isArchiving,
  isReactivating,
  isEndingLease,
  isOpeningLease,
  isDeleting,
  actionError,
  actionSuccess,
  saveWarning,
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [displayedWarning, setDisplayedWarning] = useState(null);
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

  // Auto-dismiss saveWarning after 3 seconds
  useEffect(() => {
    if (saveWarning) {
      setDisplayedWarning(saveWarning);
      const timer = setTimeout(() => {
        setDisplayedWarning(null);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setDisplayedWarning(null);
    }
  }, [saveWarning]);

  const onViewDetails = useCallback(() => {
    if (selectedTenantId && typeof window !== "undefined") {
      window.open(`/tenants/view-details?id=${selectedTenantId}`, "_blank");
    }
  }, [selectedTenantId]);

  const archiveLabel = isArchived ? "Archived" : "Archive";
  const endLeaseLabel = isEndingLease ? "Ending…" : "End Lease";
  const openLeaseLabel = isOpeningLease ? "Opening…" : "Open Lease";
  const deleteLabel = isDeleting ? "Deleting…" : "Delete";
  const activateLabel = isReactivating ? "Activating…" : "Activate";

  const endLeaseTitle = isArchived
    ? "This tenant is archived"
    : !canEndLease
      ? "No active lease"
      : "";

  const openLeaseTitle = isArchived
    ? "Activate the tenant first"
    : canOpenLease
      ? ""
      : "No ended lease";

  const saveErrorText = (() => {
    if (!error) return null;
    if (typeof error?.message === "string" && error.message.trim() !== "") {
      return error.message;
    }
    return "Could not save tenant. Make sure the unit is valid and dates are valid.";
  })();

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {detailTitle}
          </h2>
          <p className="text-sm text-slate-500">{detailSubtitle}</p>
        </div>

        {showEditButton ? (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={onViewDetails}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>

            <button
              onClick={onStartEdit}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-slate-700"
            >
              <Save className="w-4 h-4" />
              Edit
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
                  {canEndLease ? (
                    <button
                      onClick={() => {
                        onEndLease();
                        setShowMoreMenu(false);
                      }}
                      disabled={
                        !canEndLease ||
                        isEndingLease ||
                        isDeleting ||
                        isArchived
                      }
                      title={endLeaseTitle}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-t-lg"
                    >
                      <Ban className="w-4 h-4" />
                      {endLeaseLabel}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onOpenLease();
                        setShowMoreMenu(false);
                      }}
                      disabled={
                        isOpeningLease ||
                        isDeleting ||
                        isArchived ||
                        !canOpenLease
                      }
                      title={openLeaseTitle}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-t-lg"
                    >
                      <DoorOpen className="w-4 h-4" />
                      {openLeaseLabel}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onDelete();
                      setShowMoreMenu(false);
                    }}
                    disabled={
                      isDeleting ||
                      isArchiving ||
                      isEndingLease ||
                      isReactivating
                    }
                    className="w-full text-left px-4 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleteLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {actionError ? (
        <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      {actionSuccess ? (
        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Action Successful.
        </div>
      ) : null}

      {displayedWarning ? (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          {displayedWarning}
        </div>
      ) : null}

      {(isCreating || isEditing) && (
        <div className="mt-4">
          <TenantForm tenantForm={tenantForm} onChange={onTenantFormChange} />

          {isCreating || isEditing ? (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Assign tenant to a unit
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Select Landlord → Property → Unit and set lease dates.
              </p>

              <LeaseForm
                leaseForm={leaseForm}
                onChange={onLeaseFormChange}
                landlordOptions={landlordOptions}
                propertyOptions={propertyOptions}
                unitOptions={unitOptions}
                onLandlordChange={onLandlordChange}
                onPropertyChange={onPropertyChange}
                onUnitChange={onUnitChange}
              />

              {saveErrorText ? (
                <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                  {saveErrorText}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving || !canSave}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
