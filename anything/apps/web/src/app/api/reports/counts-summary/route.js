import sql from "@/app/api/utils/sql";
import { requirePermission } from "@/app/api/utils/staff";

export async function GET(request) {
  const perm = await requirePermission(request, "reports");
  if (!perm.ok) return Response.json(perm.body, { status: perm.status });

  try {
    const [
      tenantsTotalRows,
      tenantsActiveRows,
      tenantsArchivedRows,
      landlordsTotalRows,
      landlordsActiveRows,
      propertiesTotalRows,
      unitsTotalRows,
      unitsOccupiedRows,
      leasesTotalRows,
      leasesActiveRows,
      leasesEndedRows,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM tenants`,
      sql`SELECT COUNT(*)::int AS total FROM tenants WHERE COALESCE(status, 'active') = 'active'`,
      sql`SELECT COUNT(*)::int AS total FROM tenants WHERE status = 'archived'`,
      sql`SELECT COUNT(*)::int AS total FROM landlords`,
      sql`SELECT COUNT(*)::int AS total FROM landlords WHERE COALESCE(status, 'active') = 'active'`,
      sql`SELECT COUNT(*)::int AS total FROM properties`,
      sql`SELECT COUNT(*)::int AS total FROM units`,
      sql`
        SELECT COUNT(*)::int AS total
        FROM units u
        WHERE EXISTS (
          SELECT 1 FROM leases l
          WHERE l.unit_id = u.id AND l.status = 'active'
        )
      `,
      sql`SELECT COUNT(*)::int AS total FROM leases`,
      sql`SELECT COUNT(*)::int AS total FROM leases WHERE status = 'active'`,
      sql`SELECT COUNT(*)::int AS total FROM leases WHERE status = 'ended'`,
    ]);

    const tenants_total = Number(tenantsTotalRows?.[0]?.total || 0);
    const tenants_active = Number(tenantsActiveRows?.[0]?.total || 0);
    const tenants_archived = Number(tenantsArchivedRows?.[0]?.total || 0);
    const landlords_total = Number(landlordsTotalRows?.[0]?.total || 0);
    const landlords_active = Number(landlordsActiveRows?.[0]?.total || 0);
    const properties_total = Number(propertiesTotalRows?.[0]?.total || 0);
    const units_total = Number(unitsTotalRows?.[0]?.total || 0);
    const units_occupied = Number(unitsOccupiedRows?.[0]?.total || 0);
    const units_vacant = units_total - units_occupied;
    const leases_total = Number(leasesTotalRows?.[0]?.total || 0);
    const leases_active = Number(leasesActiveRows?.[0]?.total || 0);
    const leases_ended = Number(leasesEndedRows?.[0]?.total || 0);

    return Response.json({
      tenants_total,
      tenants_active,
      tenants_archived,
      landlords_total,
      landlords_active,
      properties_total,
      units_total,
      units_occupied,
      units_vacant,
      leases_total,
      leases_active,
      leases_ended,
    });
  } catch (error) {
    console.error("GET /api/reports/counts-summary error", error);
    return Response.json(
      { error: "Failed to build counts summary" },
      { status: 500 },
    );
  }
}
