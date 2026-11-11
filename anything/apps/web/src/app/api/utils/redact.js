// Server-side removal of sensitive fields for non-admin callers. Hiding a
// field in the UI is not enough; GET responses must not carry it at all.

export function isAdminStaff(staff) {
  return staff?.role_name === "Admin";
}

// Landlord payout details (bank / mobile money). payment_method stays.
export const LANDLORD_PAYOUT_FIELDS = [
  "bank_name",
  "bank_account_title",
  "bank_account_number",
  "mobile_money_name",
  "mobile_money_phone",
];

export const TENANT_SENSITIVE_FIELDS = ["national_id"];

// Employee pay-out details and salary. payment_method stays.
export const EMPLOYEE_SENSITIVE_FIELDS = [
  "payment_details",
  "payment_bank_name",
  "payment_account_number",
  "payment_account_name",
  "payment_phone",
  "current_salary",
  "salary_effective_date",
];

/** Returns a copy of row without the given keys (rows pass through as-is for admins). */
export function omitFields(row, fields) {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  for (const f of fields) delete copy[f];
  return copy;
}

/** Strips fields from a row or an array of rows unless staff is Admin. */
export function redactForStaff(staff, rows, fields) {
  if (isAdminStaff(staff)) return rows;
  if (Array.isArray(rows)) return rows.map((r) => omitFields(r, fields));
  return omitFields(rows, fields);
}
