import sql from "@/app/api/utils/sql";

export function isManagerScoped(staff) {
  return staff?.role_name === "Portfolio Manager";
}

export async function getManagerScope(perm) {
  if (!isManagerScoped(perm?.staff)) {
    return { scoped: false };
  }

  const staffId = Number(perm.staff.id);
  const rows = await sql(
    `SELECT id FROM properties WHERE assigned_officer_id = $1`,
    [staffId],
  );

  return {
    scoped: true,
    staffId,
    propertyIds: rows.map((r) => Number(r.id)),
  };
}
