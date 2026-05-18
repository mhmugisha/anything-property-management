import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function POST(request, { params }) {
  const perm = await requirePermission(request, "accounting");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const flagId = Number(params?.id);
    if (!flagId) {
      return Response.json({ error: "Invalid flag id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const resolution_note = (body?.resolution_note || "").trim() || "Reviewed — no action required";

    const updated = await sql`
      UPDATE lease_review_flags
      SET resolved_at     = NOW(),
          resolved_by     = ${perm.staff.id},
          resolution_note = ${resolution_note}
      WHERE id          = ${flagId}
        AND resolved_at IS NULL
      RETURNING id, lease_id, reason, resolved_at, resolved_by, resolution_note
    `;

    if (!updated.length) {
      return Response.json(
        { error: "Flag not found or already resolved" },
        { status: 404 },
      );
    }

    return Response.json({ flag: updated[0] });
  } catch (error) {
    console.error("POST /api/leases/flags/[id]/resolve error", error);
    return Response.json({ error: "Failed to resolve flag" }, { status: 500 });
  }
}
