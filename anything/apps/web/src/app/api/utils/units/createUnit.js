import sql from "@/app/api/utils/sql";

const UNIT_COLUMNS = [
  "property_id",
  "unit_number",
  "bedrooms",
  "bathrooms",
  "square_feet",
  "monthly_rent_ugx",
  "monthly_rent_usd",
  "deposit_amount",
  "status",
  "photos",
];

/**
 * The one place a unit is inserted into `units`, together with the
 * properties.total_units recalc, in ONE statement so they commit together.
 * Used by the Admin create path and by unit_submissions approval.
 *
 * The source row comes from either:
 *   - `values` (Admin create): the unit fields as parameters, or
 *   - `submissionId` (approval): DELETE FROM unit_submissions ... RETURNING,
 *     which doubles as the claim — a second approval finds no row. The
 *     DELETE only fires if the unit_number is not already in `units` for the
 *     property and the property isn't archived; otherwise the submission
 *     stays pending. units has
 *     UNIQUE (property_id, unit_number); if a concurrent insert wins the race,
 *     the statement fails as a whole (23505) and the submission stays put.
 *
 * Returns { unit, submission } (submission is null for `values`), or null if
 * nothing was inserted (submission gone or unit_number taken).
 */
export async function insertUnitWithRecalc({
  values = null,
  submissionId = null,
  status = "vacant",
}) {
  if (!values === !submissionId) {
    throw new Error("Pass exactly one of values or submissionId");
  }

  const params = [];
  const p = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  let srcCte;
  if (submissionId) {
    srcCte = `
      src AS (
        DELETE FROM unit_submissions s
        WHERE s.id = ${p(submissionId)}::int
          AND NOT EXISTS (
            SELECT 1 FROM units u
            WHERE u.property_id = s.property_id
              AND u.unit_number = s.unit_number
          )
          AND NOT EXISTS (
            SELECT 1 FROM properties ap
            WHERE ap.id = s.property_id AND COALESCE(ap.is_deleted, false) = true
          )
        RETURNING
          s.property_id, s.unit_number, s.bedrooms, s.bathrooms, s.square_feet,
          s.monthly_rent_ugx, s.monthly_rent_usd, s.deposit_amount,
          ${p(status)}::varchar AS status,
          COALESCE(s.photos, ARRAY[]::text[]) AS photos,
          to_jsonb(s.*) AS submission
      )`;
  } else {
    srcCte = `
      src AS (
        SELECT
          ${p(values.property_id)}::int AS property_id,
          ${p(values.unit_number)}::varchar AS unit_number,
          ${p(values.bedrooms)}::int AS bedrooms,
          ${p(values.bathrooms)}::int AS bathrooms,
          ${p(values.square_feet)}::numeric AS square_feet,
          ${p(values.monthly_rent_ugx)}::numeric AS monthly_rent_ugx,
          ${p(values.monthly_rent_usd)}::numeric AS monthly_rent_usd,
          ${p(values.deposit_amount)}::numeric AS deposit_amount,
          ${p(values.status || status)}::varchar AS status,
          ${p(Array.isArray(values.photos) ? values.photos : [])}::text[] AS photos,
          NULL::jsonb AS submission
      )`;
  }

  // The UPDATE runs on the statement's snapshot, which can't see new_unit's
  // row yet, so the count adds it explicitly.
  const query = `
    WITH ${srcCte},
    new_unit AS (
      INSERT INTO units (${UNIT_COLUMNS.join(", ")})
      SELECT ${UNIT_COLUMNS.join(", ")} FROM src
      RETURNING *
    ),
    recalc AS (
      UPDATE properties pr
      SET total_units = (
        SELECT COUNT(*) FROM units u WHERE u.property_id = pr.id
      ) + (SELECT COUNT(*) FROM new_unit)
      WHERE pr.id IN (SELECT property_id FROM new_unit)
      RETURNING pr.id
    )
    SELECT
      nu.*,
      (SELECT submission FROM src) AS __submission,
      (SELECT COUNT(*) FROM recalc)::int AS __recalculated
    FROM new_unit nu
  `;

  const rows = await sql(query, params);
  const row = rows?.[0];
  if (!row) return null;
  const { __submission, __recalculated, ...unit } = row;
  return { unit, submission: __submission || null };
}
