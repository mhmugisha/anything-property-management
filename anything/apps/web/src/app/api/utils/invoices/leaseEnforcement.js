import sql from "@/app/api/utils/sql";
import { notifyAllAdminsAsync } from "@/app/api/utils/notifications";

export async function enforceLeaseAndLandlordEndings() {
  // Step 1: Auto-end landlords whose contract end_date has passed.
  // This is still correct — the admin set the end_date, so it is user-initiated.
  // No silent cascade to leases follows from this; flags are raised instead (below).
  await sql`
    UPDATE landlords
    SET status = 'ended'
    WHERE COALESCE(status, 'active') = 'active'
      AND end_date IS NOT NULL
      AND CURRENT_DATE > end_date
  `;

  // Step 2: Raise review flags for every active lease that meets a condition.
  // Does NOT touch lease.status, units.status, or invoices — a human must review.
  //
  // The partial unique index (lease_id, reason) WHERE resolved_at IS NULL
  // prevents raising a second flag for the same issue if one is already open.
  const flagged = await sql`
    INSERT INTO lease_review_flags (lease_id, reason, reason_detail)

    SELECT l.id,
           'end_date_passed',
           'Lease end date ' || l.end_date::text || ' has passed'
    FROM leases l
    WHERE l.status = 'active'
      AND CURRENT_DATE > l.end_date

    UNION ALL

    SELECT l.id,
           'landlord_ended',
           'Landlord ' || ld.full_name || ' has status: ended'
    FROM leases l
    JOIN units      u  ON u.id  = l.unit_id
    JOIN properties p  ON p.id  = u.property_id
    JOIN landlords  ld ON ld.id = p.landlord_id
    WHERE l.status = 'active'
      AND COALESCE(ld.status, 'active') = 'ended'

    UNION ALL

    SELECT l.id,
           'landlord_contract_expired',
           'Landlord ' || ld.full_name || ' contract expired ' || ld.end_date::text
    FROM leases l
    JOIN units      u  ON u.id  = l.unit_id
    JOIN properties p  ON p.id  = u.property_id
    JOIN landlords  ld ON ld.id = p.landlord_id
    WHERE l.status = 'active'
      AND ld.end_date IS NOT NULL
      AND CURRENT_DATE > ld.end_date

    ON CONFLICT (lease_id, reason) WHERE resolved_at IS NULL DO NOTHING
    RETURNING id
  `;

  const newFlagCount = flagged.length;
  if (newFlagCount > 0) {
    notifyAllAdminsAsync({
      title: "Lease Review Required",
      message: `${newFlagCount} lease${newFlagCount === 1 ? "" : "s"} flagged for review. Open the Tenants page and filter by "Flagged" to see details.`,
      type: "lease_review",
      reference_type: "lease_review_flags",
    });
  }
}
