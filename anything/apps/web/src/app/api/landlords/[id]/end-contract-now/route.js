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

    // End the landlord's contract. Leases are NOT automatically ended —
    // the system raises review flags and a human decides what to do with each lease.
    await sql`
      UPDATE landlords
      SET end_date = CURRENT_DATE,
          status   = 'ended'
      WHERE id = ${landlordId}
    `;

    // Immediately raise 'landlord_ended' flags for all active leases under this landlord.
    // The partial unique index prevents duplicates if a flag already exists.
    const flagged = await sql`
      INSERT INTO lease_review_flags (lease_id, reason, reason_detail)
      SELECT l.id,
             'landlord_ended',
             'Landlord ' || ${oldLandlord.full_name} || ' contract ended'
      FROM leases l
      JOIN units      u  ON u.id  = l.unit_id
      JOIN properties p  ON p.id  = u.property_id
      WHERE p.landlord_id = ${landlordId}
        AND l.status = 'active'
      ON CONFLICT (lease_id, reason) WHERE resolved_at IS NULL DO NOTHING
      RETURNING id
    `;

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
    const flaggedLeases = flagged.length;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.end_contract_now",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: oldLandlord,
      newValues: { landlord, flaggedLeases },
      ipAddress: perm.ipAddress,
    });

    return Response.json({ ok: true, landlord, flaggedLeases });
  } catch (error) {
    console.error("POST /api/landlords/[id]/end-contract-now error", error);
    return Response.json({ error: "Failed to end contract" }, { status: 500 });
  }
}
