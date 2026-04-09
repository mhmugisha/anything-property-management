import { Pencil, Save, Loader2, X, FileText } from "lucide-react";
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
  propertyError,
  landlordOptions,
  units,
  onCreateUnit,
  onEditUnit,
  onDeleteUnit,
  unitsLoading,
  unitsError,
  properties,
}) {
  const isInEditMode = isCreatingProperty || isEditingProperty;

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

  return (
    <div className="flex-1 bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">{rightTitle}</h2>
          <p className="text-slate-500 text-sm">
            Manage property details and units
          </p>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {property && !isEditingProperty && !isCreatingProperty && (
            <>
              <button
                onClick={onEditProperty}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>

              <a
                href={`/properties/${property.id}/rent-roll`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
              >
                <FileText className="w-4 h-4" />
                Rent Roll
              </a>
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
          disabled={!isInEditMode}
        />
      )}

      {property && !isCreatingProperty && (
        <UnitsList
          units={units}
          onCreateUnit={onCreateUnit}
          onEditUnit={onEditUnit}
          onDeleteUnit={onDeleteUnit}
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
