import { useMemo } from "react";

export function useLeaseOptions(
  vacantUnits,
  landlordId,
  propertyId,
  landlordProperties,
) {
  const propertyOptions = useMemo(() => {
    // If landlordProperties are provided, use them (shows ALL properties for the landlord)
    if (Array.isArray(landlordProperties) && landlordProperties.length > 0) {
      const options = landlordProperties.map((p) => ({
        id: p.id,
        name: p.property_name || `Property ${p.id}`,
      }));
      options.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return options;
    }

    // Fallback: derive from vacant units (original behavior)
    const map = new Map();
    const lid = landlordId ? Number(landlordId) : null;

    for (const u of vacantUnits) {
      if (!u.property_id) continue;
      if (lid && Number(u.landlord_id) !== lid) continue;

      if (!map.has(u.property_id)) {
        map.set(u.property_id, u.property_name || `Property ${u.property_id}`);
      }
    }

    const options = Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    options.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return options;
  }, [vacantUnits, landlordId, landlordProperties]);

  const unitOptions = useMemo(() => {
    const pid = Number(propertyId);
    const filtered = pid
      ? vacantUnits.filter((u) => Number(u.property_id) === pid)
      : [];

    return filtered.map((u) => ({
      id: u.id,
      label: `Unit ${u.unit_number}`,
      unit: u,
    }));
  }, [vacantUnits, propertyId]);

  return { propertyOptions, unitOptions };
}
