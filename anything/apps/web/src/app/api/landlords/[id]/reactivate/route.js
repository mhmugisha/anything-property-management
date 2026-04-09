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
      SELECT id, title, full_name, phone, email, due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day,
        start_date,
        end_date,
        status,
        created_at
      FROM landlords
      WHERE id = ${landlordId}
      LIMIT 1
    `;

    const oldLandlord = oldRows?.[0] || null;
    if (!oldLandlord) {
      return Response.json({ error: "Landlord not found" }, { status: 404 });
    }

    const updatedRows = await sql`
      UPDATE landlords
      SET status = 'active'
      WHERE id = ${landlordId}
      RETURNING id, title, full_name, phone, email, due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day,
        start_date,
        end_date,
        status,
        created_at
    `;

    const landlord = updatedRows?.[0] || null;

    await writeAuditLog({
      staffId: perm.staff.id,
      action: "landlord.reactivate",
      entityType: "landlord",
      entityId: landlordId,
      oldValues: oldLandlord,
      newValues: landlord,
      ipAddress: perm.ipAddress,
    });

    return Response.json({ landlord });
  } catch (error) {
    console.error("POST /api/landlords/[id]/reactivate error", error);
    return Response.json(
      { error: "Failed to reactivate landlord" },
      { status: 500 },
    );
  }
}
