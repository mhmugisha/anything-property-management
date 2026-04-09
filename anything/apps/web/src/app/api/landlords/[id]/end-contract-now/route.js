import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const oldRows = await sql`
      SELECT id, title, full_name, phone, email, due_date, start_date, end_date, COALESCE(status, 'active') AS status
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const oldLandlord = oldRows?.[0] || null;
    if (!oldLandlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    if (oldLandlord.status === "archived") {
      return Response.json(
        {
          error:
            "Cannot end contract for an archived landlord. Reactivate first.",
        },
        { status: 400 },
      );
    }

    // End contract immediately (manual override):
    // - landlord becomes ended now
    // - all their active leases end now
    // - all future unpaid invoices are voided
    await sql.transaction((txn) => [
      txn(
        `
          UPDATE landlords
          SET end_date = CURRENT_DATE,
              status = 'ended'
          WHERE id = $1
        `,
        [landlordId],
      ),

      txn(
        `
          UPDATE leases l
          SET status = 'ended',
              auto_renew = false,
              end_date = CASE
                WHEN l.end_date > CURRENT_DATE THEN CURRENT_DATE
                ELSE l.end_date
              END
          FROM units u
          JOIN properties p ON p.id = u.property_id
          WHERE l.unit_id = u.id
            AND p.landlord_id = $1
            AND l.status = 'active'
        `,
        [landlordId],
      ),

      // Make units vacant only if they truly have no active lease
      txn(
        `
          UPDATE units u
          SET status = 'vacant'
          FROM properties p
          WHERE u.property_id = p.id
            AND p.landlord_id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM leases l
              WHERE l.unit_id = u.id
                AND l.status = 'active'
            )
        `,
        [landlordId],
      ),

      txn(
        `
          UPDATE invoices i
          SET status = 'void'
          FROM leases l
          JOIN units u ON u.id = l.unit_id
          JOIN properties p ON p.id = u.property_id
          WHERE i.lease_id = l.id
            AND p.landlord_id = $1
            AND i.invoice_date > CURRENT_DATE
            AND i.paid_amount = 0
            AND i.status <> 'paid'
        `,
        [landlordId],
      ),
    ]);

    const landlordRows = await sql`
      SELECT
        id,
        title,
        full_name,
        phone,
        email,
        due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day,
        start_date,
        end_date,
        COALESCE(status, 'active') AS status,
        created_at
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;

    const countRows = await sql(
      `
        SELECT COUNT(*)::int AS ended_leases
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        JOIN properties p ON p.id = u.property_id
        WHERE p.landlord_id = $1
          AND l.status = 'ended'
          AND l.end_date = CURRENT_DATE
      `,
      [landlordId],
    );

    const endedLeases = Number(countRows?.[0]?.ended_leases || 0);

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.end_contract_now",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: oldLandlord,
      newValues: { landlord, endedLeases },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true, landlord, endedLeases });
  } catch (error) {
    console.error("POST /api/landlords/[id]/end-contract-now error", error);
    return Response.json({ error: "Failed to end contract" }, { status: 500 });
  }
}
