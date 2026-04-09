import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function endActiveLeasesForLandlord({ landlordId }) {
  const activeLeaseRows = await sql(
    `
      SELECT l.id, l.unit_id
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE p.landlord_id = $1
        AND l.status = 'active'
    `,
    [landlordId],
  );

  const leaseIds = (activeLeaseRows || [])
    .map((r) => Number(r.id))
    .filter(Boolean);
  const unitIds = (activeLeaseRows || [])
    .map((r) => Number(r.unit_id))
    .filter(Boolean);

  if (leaseIds.length === 0) {
    return { endedLeases: 0 };
  }

  await sql.transaction((txn) => [
    txn(
      `
        UPDATE leases
        SET status = 'ended',
            auto_renew = false,
            end_date = CASE
              WHEN end_date > CURRENT_DATE THEN CURRENT_DATE
              ELSE end_date
            END
        WHERE id = ANY($1::int[])
      `,
      [leaseIds],
    ),

    unitIds.length
      ? txn(`UPDATE units SET status = 'vacant' WHERE id = ANY($1::int[])`, [
          unitIds,
        ])
      : txn`SELECT 1`,

    txn(
      `
        UPDATE invoices
        SET status = 'void'
        WHERE lease_id = ANY($1::int[])
          AND invoice_date > CURRENT_DATE
          AND paid_amount = 0
          AND status <> 'paid'
      `,
      [leaseIds],
    ),
  ]);

  return { endedLeases: leaseIds.length };
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "properties");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const landlordId = toNumber(params?.id);
    if (!landlordId) {
      return Response.json({ error: "Invalid landlord id" }, { status: 400 });
    }

    const landlordRows = await sql`
      SELECT id, title, full_name, phone, email, due_date, start_date, end_date, status, created_at
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    // End any active leases under this landlord (same idea as Tenant archive)
    const ended = await endActiveLeasesForLandlord({ landlordId });

    const updatedRows = await sql`
      UPDATE landlords
      SET status = 'archived'
      WHERE id = ${landlordId}
      RETURNING id, title, full_name, phone, email, due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day,
        start_date,
        end_date,
        status,
        created_at
    `;

    const updated = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.archive",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: landlord,
      newValues: { ...updated, ...ended },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ landlord: updated, ...ended });
  } catch (error) {
    console.error("POST /api/landlords/[id]/archive error", error);
    return Response.json(
      { error: "Failed to archive landlord" },
      { status: 500 },
    );
  }
}
