import { Field } from "./Field";

export function TenantForm({ tenantForm, onChange, isAdmin = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Full name">
        <input
          value={tenantForm.full_name}
          onChange={(e) =>
            onChange({ ...tenantForm, full_name: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
        />
      </Field>
      <Field label="Phone">
        <input
          value={tenantForm.phone}
          onChange={(e) => onChange({ ...tenantForm, phone: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          placeholder="+256..."
        />
      </Field>
      <Field label="Email (optional)">
        <input
          value={tenantForm.email}
          onChange={(e) => onChange({ ...tenantForm, email: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
        />
      </Field>
      <Field label="National ID (optional)">
        <input
          value={tenantForm.national_id}
          onChange={(e) =>
            onChange({ ...tenantForm, national_id: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
        />
      </Field>
      <Field label="Emergency phone (optional)">
        <input
          value={tenantForm.emergency_phone}
          onChange={(e) =>
            onChange({ ...tenantForm, emergency_phone: e.target.value })
          }
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
        />
      </Field>
      <Field label="Status">
        {/* Status is admin-only; the server ignores it from anyone else. */}
        <select
          value={tenantForm.status}
          onChange={(e) => onChange({ ...tenantForm, status: e.target.value })}
          disabled={!isAdmin}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        {!isAdmin ? (
          <p className="mt-1 text-xs text-slate-500">
            Only an admin can change status.
          </p>
        ) : null}
      </Field>
    </div>
  );
}
