import { X, Save, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Field } from "./Field";

export function UnitFormModal({
  isOpen,
  form,
  onChange,
  onSave,
  onClose,
  onAddPhotos,
  isEditing,
  isSaving,
  error,
  uploadLoading,
  propertyType,
  onClearError,
}) {
  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error && onClearError) {
      const timer = setTimeout(() => {
        onClearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, onClearError]);

  if (!isOpen) return null;

  const propertyTypeText = propertyType ? String(propertyType) : "";
  const propertyTypeNormalized = propertyTypeText.trim().toLowerCase();
  const isCommercialOnly = propertyTypeNormalized === "commercial";
  const showBedroomsBathrooms = !isCommercialOnly;

  return (
    <div className="fixed inset-0 z-30 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full md:w-[720px] bg-white rounded-t-2xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {isEditing ? "Edit unit" : "Add unit"}
            </h3>
            <p className="text-sm text-slate-500">
              Upload photos and capture rent details.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="Unit number"
            value={form.unit_number}
            onChange={(v) => onChange({ ...form, unit_number: v })}
            placeholder="e.g. 101 or A-101"
            type="text"
          />
          <Field
            label="Status"
            value={form.status}
            onChange={(v) => onChange({ ...form, status: v })}
            asSelect
            options={[
              { value: "vacant", label: "Vacant" },
              { value: "occupied", label: "Occupied" },
              { value: "maintenance", label: "Maintenance" },
            ]}
          />

          {showBedroomsBathrooms && (
            <>
              <Field
                label="Bedrooms"
                value={String(form.bedrooms)}
                onChange={(v) => onChange({ ...form, bedrooms: v })}
                type="number"
              />
              <Field
                label="Bathrooms"
                value={String(form.bathrooms)}
                onChange={(v) => onChange({ ...form, bathrooms: v })}
                type="number"
              />
            </>
          )}

          <Field
            label="Rent (UGX)"
            value={String(form.monthly_rent_ugx)}
            onChange={(v) => onChange({ ...form, monthly_rent_ugx: v })}
            type="number"
          />
          <Field
            label="Square feet"
            value={String(form.square_feet)}
            onChange={(v) => onChange({ ...form, square_feet: v })}
            type="number"
          />

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Photos
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const fileList = e.target.files;
                  const arr = fileList ? Array.from(fileList) : [];
                  onAddPhotos(arr);
                  e.target.value = "";
                }}
                className="block w-full text-sm"
              />
              {uploadLoading && (
                <span className="text-sm text-slate-500">Uploading…</span>
              )}
            </div>

            {Array.isArray(form.photos) && form.photos.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                {form.photos.map((url) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt="Unit"
                      className="w-full h-20 object-cover rounded-lg border border-gray-100"
                    />
                    <button
                      onClick={() => {
                        const next = form.photos.filter((p) => p !== url);
                        onChange({ ...form, photos: next });
                      }}
                      className="absolute top-1 right-1 bg-white/90 hover:bg-white text-slate-700 rounded-full p-1 border border-gray-200"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-5 py-3 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save unit
          </button>
        </div>

        {error && (
          <p className="text-sm text-rose-600 mt-3">
            Could not save unit. Check unit number uniqueness.
          </p>
        )}
      </div>
    </div>
  );
}
