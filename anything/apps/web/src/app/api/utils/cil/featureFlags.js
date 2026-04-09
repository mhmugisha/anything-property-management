import sql from "@/app/api/utils/sql";

export async function isFeatureEnabled(flagName) {
  const name = String(flagName || "").trim();
  if (!name) return false;

  try {
    const rows = await sql(
      "SELECT enabled FROM integration_feature_flags WHERE flag_name = $1 LIMIT 1",
      [name],
    );
    return rows?.[0]?.enabled === true;
  } catch (e) {
    // If the table doesn't exist (or any other issue), fail closed.
    console.error("isFeatureEnabled error", e);
    return false;
  }
}
