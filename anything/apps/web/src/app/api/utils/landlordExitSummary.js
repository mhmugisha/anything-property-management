import sql from "@/app/api/utils/sql";
import {
  getDueToLandlordsBalance,
  getLeaseDepositBalance,
  getTenantPrepaymentBalance,
} from "@/app/api/utils/accounting";
import { buildLandlordEvents } from "@/app/api/utils/landlordEvents";
import { evaluateLandlordCloseGate } from "@/app/api/utils/landlordCloseGate";

/**
 * Read-only landlord exit preview: every property the landlord owns
 * (archived ones included — their rent history is still owed), the active
 * leases on each, what is due to the landlord, and whether they can close.
 * Writes nothing.
 *
 * net_due is Σ getDueToLandlordsBalance over the landlord's properties.
 * Positive means the agency owes the landlord; negative means the landlord
 * owes the agency.
 *
 * events_closing_balance is the net of every buildLandlordEvents event (no
 * date cap, so future-month invoices count, as they do in the helper).
 * events_match is false when the two figures diverge by 1 UGX or more.
 *
 * @param {number} landlordId
 */
export async function getLandlordExitSummary(landlordId) {
  const propertyRows = await sql`
    SELECT id, property_name, COALESCE(is_deleted, false) AS is_archived
    FROM properties
    WHERE landlord_id = ${landlordId}
    ORDER BY property_name, id
  `;

  // Same outstanding rule as the property decommission summary.
  const leaseRows = await sql`
    SELECT
      l.id AS lease_id,
      l.tenant_id,
      t.full_name AS tenant_name,
      u.property_id,
      u.unit_number,
      l.end_date,
      COALESCE(inv.outstanding, 0) AS outstanding
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN properties p ON p.id = u.property_id
    JOIN tenants t ON t.id = l.tenant_id
    LEFT JOIN LATERAL (
      SELECT SUM(i.amount - i.paid_amount) AS outstanding
      FROM invoices i
      WHERE i.lease_id = l.id
        AND i.status <> 'void'
        AND COALESCE(i.is_deleted, false) = false
    ) inv ON true
    WHERE p.landlord_id = ${landlordId}
      AND l.status = 'active'
    ORDER BY u.unit_number, l.id
  `;

  const leasesByProperty = new Map();
  for (const r of leaseRows || []) {
    const [depositHeld, prepayment] = await Promise.all([
      getLeaseDepositBalance(r.lease_id),
      getTenantPrepaymentBalance(r.tenant_id),
    ]);
    const pid = Number(r.property_id);
    if (!leasesByProperty.has(pid)) leasesByProperty.set(pid, []);
    leasesByProperty.get(pid).push({
      lease_id: Number(r.lease_id),
      tenant_id: Number(r.tenant_id),
      tenant_name: r.tenant_name,
      unit_number: r.unit_number,
      end_date: r.end_date,
      outstanding: Number(r.outstanding || 0),
      deposit_held: Number(depositHeld || 0),
      // Tenant-wide: includes prepayments for the tenant's other leases.
      prepayment: Number(prepayment || 0),
    });
  }

  const properties = [];
  for (const p of propertyRows || []) {
    const propertyId = Number(p.id);
    const activeLeases = leasesByProperty.get(propertyId) || [];
    const netDue = Number(
      (await getDueToLandlordsBalance({ landlordId, propertyId })) || 0,
    );
    properties.push({
      property_id: propertyId,
      property_name: p.property_name,
      is_archived: p.is_archived === true,
      active_lease_count: activeLeases.length,
      active_leases: activeLeases,
      net_due: netDue,
    });
  }

  const netDue = properties.reduce((s, p) => s + p.net_due, 0);
  const activeLeasesCount = (leaseRows || []).length;
  const livePropertiesCount = properties.filter((p) => !p.is_archived).length;

  const { events } = await buildLandlordEvents(landlordId);
  const eventsClosingBalance = (events || []).reduce(
    (s, e) => s + (Number(e.credit || 0) - Number(e.debit || 0)),
    0,
  );
  const eventsDifference = eventsClosingBalance - netDue;

  const gate = evaluateLandlordCloseGate({
    activeLeasesCount,
    livePropertiesCount,
    netDue,
  });

  return {
    properties,
    net_due: netDue,
    net_due_meaning:
      "positive = agency owes landlord; negative = landlord owes agency",
    active_leases_count: activeLeasesCount,
    live_properties_count: livePropertiesCount,
    // Active leases = 0, live properties = 0 and net due >= 0. A positive
    // net due is settled by the close payout, so it doesn't block.
    can_close: gate.can_close,
    close_blockers: gate.close_blockers,
    close_blocker_codes: gate.close_blocker_codes,
    events_closing_balance: eventsClosingBalance,
    events_difference: eventsDifference,
    events_match: Math.abs(eventsDifference) < 1,
  };
}
