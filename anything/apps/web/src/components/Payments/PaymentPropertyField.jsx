import { Field } from "./Field";

/**
 * Which property a tenant-level payment (Payment on Account, Allocate from
 * Holding) belongs to. Credit is scoped per property, so this must never be
 * guessed when the tenant has active leases at more than one property.
 *
 * Returns { propertyId, propertyName, options, mustChoose }:
 *  - one active-lease property  -> that property, auto-filled
 *  - several                    -> propertyId "" and options to choose from
 *  - none (no active lease)     -> the tenant's latest lease property, as before
 */
export function pickPaymentProperty(tenant) {
  if (!tenant) {
    return { propertyId: "", propertyName: "", options: [], mustChoose: false };
  }
  const options = Array.isArray(tenant.active_properties)
    ? tenant.active_properties
        .filter((o) => o && o.property_id)
        .map((o) => ({
          property_id: String(o.property_id),
          property_name: o.property_name || `Property ${o.property_id}`,
        }))
    : [];

  if (options.length > 1) {
    return { propertyId: "", propertyName: "", options, mustChoose: true };
  }
  if (options.length === 1) {
    return {
      propertyId: options[0].property_id,
      propertyName: options[0].property_name,
      options,
      mustChoose: false,
    };
  }
  if (tenant.current_property_id) {
    return {
      propertyId: String(tenant.current_property_id),
      propertyName: tenant.current_property_name || "",
      options: [],
      mustChoose: false,
    };
  }
  return { propertyId: "", propertyName: "", options: [], mustChoose: false };
}

/**
 * Read-only when the property is unambiguous; a required select when the
 * tenant has active leases at more than one property.
 */
export function PaymentPropertyField({
  tenantId,
  propertyId,
  propertyName,
  options,
  mustChoose,
  onChoose,
}) {
  if (mustChoose) {
    return (
      <Field label="Property (choose — tenant has leases at more than one)">
        <select
          value={propertyId}
          onChange={(e) => {
            const opt = options.find((o) => o.property_id === e.target.value);
            onChoose(e.target.value, opt?.property_name || "");
          }}
          className={`w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white ${
            propertyId ? "border-gray-200" : "border-amber-400"
          }`}
        >
          <option value="">Select property…</option>
          {options.map((o) => (
            <option key={o.property_id} value={o.property_id}>
              {o.property_name}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <Field label="Property (Auto-filled)">
      <input
        type="text"
        value={propertyName || (tenantId ? "No active lease" : "")}
        readOnly
        placeholder={tenantId ? "" : "Select tenant first..."}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 outline-none text-sm text-slate-600"
      />
    </Field>
  );
}
