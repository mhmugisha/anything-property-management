/**
 * Returns the approval status for a new entry based on the staff role.
 * Admins auto-approve their own entries.
 * All other staff create pending entries requiring Admin approval.
 */
export function getApprovalStatus(staff) {
  if (!staff) return 'pending';
  return staff.role_name === 'Admin' ? 'approved' : 'pending';
}

/**
 * Returns approval fields to include in an INSERT query.
 */
export function getApprovalFields(staff) {
  const status = getApprovalStatus(staff);
  return {
    approval_status: status,
    approved_by: status === 'approved' ? (staff?.id || null) : null,
    approved_at: status === 'approved' ? new Date().toISOString() : null,
  };
}
