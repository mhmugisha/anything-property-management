import sql from "@/app/api/utils/sql";

export async function enforceLeaseAndLandlordEndings() {
  // This gets called in places that "ensure invoices" so the system stays consistent
  // even without a background job.
  await sql.transaction((txn) => [
    // 1) If a landlord contract end_date has passed, mark them ended.
    txn`
      UPDATE landlords
      SET status = 'ended'
      WHERE COALESCE(status, 'active') = 'active'
        AND end_date IS NOT NULL
        AND CURRENT_DATE > end_date
    `,

    // 2) End leases if their end_date has passed, tenant is archived, or landlord is ended/archived.
    // IMPORTANT: In Postgres, the UPDATE target table alias (l) can't be referenced inside JOIN ... ON
    // clauses in the FROM section. Link tables using WHERE instead.
    txn`
      UPDATE leases l
      SET status = 'ended',
          auto_renew = false,
          end_date = CASE
            WHEN l.end_date > CURRENT_DATE THEN CURRENT_DATE
            ELSE l.end_date
          END
      FROM tenants t, units u, properties p, landlords ld
      WHERE t.id = l.tenant_id
        AND u.id = l.unit_id
        AND p.id = u.property_id
        AND ld.id = p.landlord_id
        AND l.status = 'active'
        AND (
          CURRENT_DATE > l.end_date
          OR COALESCE(t.status, 'active') <> 'active'
          OR COALESCE(ld.status, 'active') <> 'active'
          OR (ld.end_date IS NOT NULL AND CURRENT_DATE > ld.end_date)
        )
    `,

    // 3) Mark units vacant only when they truly have no active lease.
    txn`
      UPDATE units u
      SET status = 'vacant'
      WHERE NOT EXISTS (
        SELECT 1
        FROM leases l
        WHERE l.unit_id = u.id
          AND l.status = 'active'
      )
    `,

    // 4) Void future invoices for any lease/tenant/landlord that is no longer active.
    txn`
      UPDATE invoices i
      SET status = 'void'
      FROM leases l
      JOIN tenants t ON t.id = l.tenant_id
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      JOIN landlords ld ON ld.id = p.landlord_id
      WHERE i.lease_id = l.id
        AND i.invoice_date > CURRENT_DATE
        AND i.paid_amount = 0
        AND i.status <> 'paid'
        AND (
          l.status <> 'active'
          OR COALESCE(t.status, 'active') <> 'active'
          OR COALESCE(ld.status, 'active') <> 'active'
          OR (ld.end_date IS NOT NULL AND CURRENT_DATE > ld.end_date)
        )
    `,
  ]);
}
