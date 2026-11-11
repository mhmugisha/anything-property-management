import sql from "@/app/api/utils/sql";
import { writeAuditLog } from "@/app/api/utils/staff";
import {
  createNotification,
  notifyAllAdminsAsync,
} from "@/app/api/utils/notifications";
import { insertUnitWithRecalc } from "@/app/api/utils/units/createUnit";

// Units proposed by non-admins live only in unit_submissions until an Admin
// approves them, so they are invisible to every query that reads `units`.

function notifyRequester(submission, title, message) {
  try {
    createNotification({
      user_id: submission.requested_by,
      title,
      message,
      type: "approval",
      reference_id: submission.id,
      reference_type: "unit_submission",
    });
  } catch (notifError) {
    console.error("createNotification failed (non-blocking)", notifError);
  }
}

async function bestEffortAudit(entry) {
  try {
    await writeAuditLog(entry);
  } catch (e) {
    console.error(`Failed to write audit log for ${entry.action}`, e);
  }
}

function isUniqueViolation(error) {
  return error?.code === "23505" || /duplicate key/i.test(error?.message || "");
}

/**
 * Non-admin "Add Unit": store the proposal. 409 if the unit_number is already
 * in `units` or `unit_submissions` for the property. Returns { status, body }.
 */
export async function submitUnit({ propertyId, values, perm }) {
  for (const key of ["monthly_rent_ugx", "monthly_rent_usd", "deposit_amount"]) {
    if (values[key] !== null && values[key] < 0) {
      return { status: 400, body: { error: `${key} cannot be negative` } };
    }
  }

  const props = await sql`
    SELECT id, property_name, COALESCE(is_deleted, false) AS is_archived
    FROM properties WHERE id = ${propertyId} LIMIT 1
  `;
  const property = props?.[0] || null;
  if (!property) {
    return { status: 404, body: { error: "Property not found" } };
  }
  if (property.is_archived) {
    return { status: 409, body: { error: "This property is archived" } };
  }

  const duplicate = {
    status: 409,
    body: { error: `Unit ${values.unit_number} already exists or is awaiting approval for this property` },
  };

  let rows;
  try {
    rows = await sql`
      INSERT INTO unit_submissions (
        property_id, unit_number, bedrooms, bathrooms, square_feet,
        monthly_rent_ugx, monthly_rent_usd, deposit_amount, photos, requested_by
      )
      SELECT
        ${propertyId}::int, ${values.unit_number}::varchar,
        ${values.bedrooms}::int, ${values.bathrooms}::int,
        ${values.square_feet}::numeric, ${values.monthly_rent_ugx}::numeric,
        ${values.monthly_rent_usd}::numeric, ${values.deposit_amount}::numeric,
        ${values.photos}::text[], ${perm.staff.id}::int
      WHERE NOT EXISTS (
        SELECT 1 FROM units
        WHERE property_id = ${propertyId}::int
          AND unit_number = ${values.unit_number}::varchar
      )
      ON CONFLICT (property_id, unit_number) DO NOTHING
      RETURNING *
    `;
  } catch (error) {
    if (isUniqueViolation(error)) return duplicate;
    throw error;
  }

  const submission = rows?.[0] || null;
  if (!submission) return duplicate;

  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "unit_submission.create",
    entityType: "unit_submission",
    entityId: submission.id,
    oldValues: null,
    newValues: submission,
    ipAddress: perm.ipAddress,
  });

  notifyAllAdminsAsync({
    title: "New Unit Pending Approval",
    message: `Unit ${submission.unit_number} at ${property.property_name} was submitted for approval by ${perm.staff.full_name || "Staff"}.`,
    type: "approval",
    reference_id: submission.id,
    reference_type: "unit_submission",
  });

  return { status: 201, body: { submission, pending: true } };
}

/**
 * Approve: create the unit from the submission via the shared helper (the
 * submission DELETE is the claim) in one statement. Returns { status, body }.
 */
export async function approveUnitSubmission({ submissionId, perm }) {
  let created;
  try {
    created = await insertUnitWithRecalc({ submissionId, status: "vacant" });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    created = null; // a concurrent insert took the unit_number; nothing committed
  }

  if (!created) {
    const still = await sql`
      SELECT s.id, COALESCE(p.is_deleted, false) AS property_archived
      FROM unit_submissions s
      JOIN properties p ON p.id = s.property_id
      WHERE s.id = ${submissionId} LIMIT 1
    `;
    if (still.length === 0) {
      return { status: 409, body: { error: "This submission was already processed" } };
    }
    if (still[0].property_archived) {
      return {
        status: 409,
        body: { error: "The property is archived. The submission is still pending." },
      };
    }
    return {
      status: 409,
      body: {
        error:
          "A unit with this number already exists for the property. The submission is still pending.",
      },
    };
  }

  const { unit, submission } = created;

  // The unit is recorded as created by the requester; the approval by the admin.
  await bestEffortAudit({
    staffId: submission.requested_by,
    action: "units.create",
    entityType: "units",
    entityId: unit?.id || null,
    oldValues: null,
    newValues: unit,
    ipAddress: perm.ipAddress,
  });
  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "approval.approve",
    entityType: "unit_submission",
    entityId: submissionId,
    oldValues: { submission },
    newValues: { unit_id: unit?.id || null },
    ipAddress: perm.ipAddress,
  });

  notifyRequester(
    submission,
    "Unit Approved",
    `Unit ${submission.unit_number} you submitted has been approved and is now live.`,
  );

  return { status: 200, body: { ok: true, action: "approve", unit } };
}

/**
 * Reject: delete the submission. Nothing was written to `units`, so there is
 * nothing to unwind. The reason lives in the audit log and the requester's
 * notification. Returns { status, body }.
 */
export async function rejectUnitSubmission({ submissionId, reason, perm }) {
  const rows = await sql`
    DELETE FROM unit_submissions WHERE id = ${submissionId} RETURNING *
  `;
  const submission = rows?.[0] || null;
  if (!submission) {
    return { status: 409, body: { error: "This submission was already processed" } };
  }

  await bestEffortAudit({
    staffId: perm.staff.id,
    action: "approval.reject",
    entityType: "unit_submission",
    entityId: submissionId,
    oldValues: { submission },
    newValues: { rejected_reason: reason || null },
    ipAddress: perm.ipAddress,
  });

  notifyRequester(
    submission,
    "Entry Not Approved",
    `Unit ${submission.unit_number} you submitted has not been approved.${
      reason ? ` Reason: ${reason}` : ""
    } Please contact admin.`,
  );

  return { status: 200, body: { ok: true, action: "reject" } };
}
