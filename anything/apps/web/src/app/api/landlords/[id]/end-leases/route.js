import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";

function toNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function endActiveLeasesForLandlord({ landlordId, staffId, ipAddress }) {
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

  await writeAuditLog({
    staffId,
    action: "landlord.end_leases",
    entityType: "landlord",
    entityId: landlordId,
    oldValues: null,
    newValues: { endedLeases: leaseIds.length },
    ipAddress,
  });

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
      SELECT id, full_name, status
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const landlord = landlordRows?.[0] || null;
    if (!landlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    const result = await endActiveLeasesForLandlord({
      landlordId,
      staffId: perm.staff.id,
      ipAddress: perm.ipAddress,
    });

    if (result.endedLeases === 0) {
      return Response.json(
        { error: "No active leases found for this landlord" },
        { status: 400 },
      );
    }

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/landlords/[id]/end-leases error", error);
    return Response.json(
      { error: "Failed to end landlord leases" },
      { status: 500 },
    );
  }
}
