import {
  Pencil,
  Save,
  Loader2,
  X,
  FileText,
  Trash2,
  Archive,
  RotateCcw,
} from "lucide-react";
import { PropertyForm } from "./PropertyForm";
import { UnitsList } from "./UnitsList";

export function PropertyDetails({
  property,
  propertyForm,
  onPropertyFormChange,
  isEditingProperty,
  isCreatingProperty,
  onEditProperty,
  onCancelProperty,
  onSaveProperty,
  isSavingProperty,
  onDeleteProperty,
  isDeletingProperty,
  onDecommissionProperty,
  onReactivateProperty,
  isReactivatingProperty,
  propertyError,
  landlordOptions,
  officerOptions,
  units,
  onCreateUnit,
  onEditUnit,
  onDeleteUnit,
  unitsLoading,
  unitsError,
  properties,
}) {
  const isInEditMode = isCreatingProperty || isEditingProperty;
  // Archived properties are read-only until reactivated.
  const isArchived = property?.is_archived === true;

  const rightTitle = isCreatingProperty
    ? "New property"
    : property
      ? property.property_name
      : "Select a property";

  const feePercentRaw =
    property &&
    property.management_fee_percent !== null &&
    property.management_fee_percent !== undefined
      ? String(property.management_fee_percent)
      : "";

  const feePercentNum =
    feePercentRaw.trim() === "" ? Number.NaN : Number(feePercentRaw);
  const defaultFeePercent = "10";
  const displayFeePercent = Number.isFinite(feePercentNum)
    ? feePercentRaw
    : defaultFeePercent;

  const displayForm = isInEditMode
    ? propertyForm
    : property
      ? {
          landlord_id: property.landlord_id ? String(property.landlord_id) : "",
          assigned_officer_id: property.assigned_officer_id
            ? String(property.assigned_officer_id)
            : "",
          property_name: property.property_name || "",
          address: property.address || "",
          property_type: property.property_type || "",
          management_fee_type: property.management_fee_type || "percent",
          management_fee_percent: displayFeePercent,
          management_fee_fixed_amount:
            property.management_fee_fixed_amount !== null &&
            property.management_fee_fixed_amount !== undefined
              ? String(property.management_fee_fixed_amount)
              : "",
          notes: property.notes || "",
        }
      : propertyForm;

  const assignedOfficerName = property?.assigned_officer_id
    ? (officerOptions || []).find(
        (o) => String(o.value) === String(property.assigned_officer_id),
      )?.label || null
    : null;

  return (
    <div className="flex-1 bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            {rightTitle}
            {isArchived && (
              <span className="ml-2 align-middle inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-slate-600 border border-gray-200">
                <Archive className="w-3 h-3" />
                Archived
              </span>
            )}
          </h2>
          <p className="text-slate-500 text-sm">
            {isArchived
              ? "Decommissioned — no rent is invoiced. Reactivate to make changes."
              : "Manage property details and units"}
          </p>
          {property && !isInEditMode && !isArchived && (
            <div className="mt-2">
              {assignedOfficerName ? (
                <span className="text-sm text-slate-600">
                  Managed by:{" "}
                  <span className="font-medium text-slate-800">
                    {assignedOfficerName}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  No Manager Assigned
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {property && !isEditingProperty && !isCreatingProperty && (
            <>
              {!isArchived && (
                <button
                  type="button"
                  onClick={onEditProperty}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              )}

              <a
                href={`/properties/${property.id}/rent-roll`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
              >
                <FileText className="w-4 h-4" />
                Rent Roll
              </a>

              {isArchived && onReactivateProperty && (
                <button
                  type="button"
                  onClick={onReactivateProperty}
                  disabled={isReactivatingProperty}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-50"
                >
                  {isReactivatingProperty ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Reactivate
                </button>
              )}

              {!isArchived && onDecommissionProperty && (
                <button
                  type="button"
                  onClick={onDecommissionProperty}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                >
                  <Archive className="w-4 h-4" />
                  Decommission
                </button>
              )}

              {!isArchived && onDeleteProperty && (
                <button
                  type="button"
                  onClick={onDeleteProperty}
                  disabled={isDeletingProperty}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 disabled:opacity-50"
                >
                  {isDeletingProperty ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              )}
            </>
          )}

          {(isEditingProperty || isCreatingProperty) && (
            <>
              <button
                onClick={onCancelProperty}
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>

              <button
                onClick={onSaveProperty}
                disabled={isSavingProperty}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
              >
                {isSavingProperty ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {(property || isInEditMode) && (
        <PropertyForm
          form={displayForm}
          onChange={onPropertyFormChange}
          error={propertyError}
          landlordOptions={landlordOptions || []}
          officerOptions={officerOptions || []}
          disabled={!isInEditMode}
        />
      )}

      {property && !isCreatingProperty && (
        <UnitsList
          units={units}
          onCreateUnit={isArchived ? undefined : onCreateUnit}
          onEditUnit={isArchived ? undefined : onEditUnit}
          onDeleteUnit={isArchived ? undefined : onDeleteUnit}
          isLoading={unitsLoading}
          error={unitsError}
        />
      )}

      {!property && !isInEditMode && (
        <div className="text-slate-500 text-sm">
          Pick a property on the left to view details.
        </div>
      )}
    </div>
  );
}
