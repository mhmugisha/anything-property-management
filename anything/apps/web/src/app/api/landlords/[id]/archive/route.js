import sql from "@/app/api/utils/sql";
import { requirePermission, writeAuditLog } from "@/app/api/utils/staff";
import { countActiveLeasesForLandlord } from "@/app/api/utils/landlordLeases";

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

    // Archive only while no lease on the landlord's properties is active, in
    // one statement, so a lease can't slip in between check and write. Leases
    // are ended one at a time through the tenant end-lease flow, never here.
    const updatedRows = await sql`
      UPDATE landlords
      SET status = 'archived'
      WHERE id = ${landlordId}
        AND NOT EXISTS (
          SELECT 1
          FROM leases l
          JOIN units u ON u.id = l.unit_id
          JOIN properties p ON p.id = u.property_id
          WHERE p.landlord_id = ${landlordId} AND l.status = 'active'
        )
      RETURNING id, title, full_name, phone, email, due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day,
        start_date,
        end_date,
        status,
        created_at
    `;

    if (!updatedRows?.length) {
      const activeCount = await countActiveLeasesForLandlord(landlordId);
      return Response.json(
        {
          error: `This landlord still has ${activeCount} active tenant lease(s). End all tenant leases before archiving.`,
          active_lease_count: activeCount,
        },
        { status: 409 },
      );
    }

    const updated = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.archive",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: landlord,
      newValues: updated,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ landlord: updated });
  } catch (error) {
    console.error("POST /api/landlords/[id]/archive error", error);
    return Response.json(
      { error: "Failed to archive landlord" },
      { status: 500 },
    );
  }
}
