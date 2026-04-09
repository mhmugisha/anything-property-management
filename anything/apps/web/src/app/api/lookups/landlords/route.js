import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  // Used by Properties / Tenants / Accounting / Reports forms.
  const perm = await requirePermission(request, "dashboard");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const like = `%${search}%`;

    const landlords = await sql`
      SELECT
        id,
        title,
        full_name,
        phone,
        email,
        due_date,
        (CASE WHEN due_date IS NULL THEN NULL ELSE EXTRACT(day FROM due_date)::int END) AS due_day
      FROM landlords
      WHERE COALESCE(status, 'active') = 'active'
        AND (
          ${search === "" ? true : false}
          OR LOWER(full_name) LIKE LOWER(${like})
          OR LOWER(COALESCE(title,'')) LIKE LOWER(${like})
          OR phone LIKE ${like}
          OR LOWER(COALESCE(email,'')) LIKE LOWER(${like})
        )
      ORDER BY full_name
      LIMIT 200
    `;

    return Response.json({ landlords });
  } catch (error) {
    console.error("GET /api/lookups/landlords error", error);
    return Response.json(
      { error: "Failed to lookup landlords" },
      { status: 500 },
    );
  }
}
