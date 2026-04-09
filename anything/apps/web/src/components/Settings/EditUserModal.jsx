import { useState } from "react";
import { Save, Eye, EyeOff, KeyRound } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./Field";

export function EditUserModal({
  open,
  onClose,
  editUserFullName,
  setEditUserFullName,
  editUserPhone,
  setEditUserPhone,
  editUserRoleId,
  setEditUserRoleId,
  editUserIsActive,
  setEditUserIsActive,
  editUserPassword,
  setEditUserPassword,
  editUserEmail,
  editUserRoleName,
  roleOptions,
  onSave,
  updateUserMutation,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const isAdminUser = editUserRoleName === "Admin";

  // Allow Admin role to be selected for all users
  const editRoleOptions = roleOptions;

  const statusBg = editUserIsActive ? "bg-emerald-50" : "bg-rose-50";
  const statusBorder = editUserIsActive
    ? "border-emerald-200"
    : "border-rose-200";
  const statusText = editUserIsActive ? "text-emerald-700" : "text-rose-700";
  const statusLabel = editUserIsActive ? "Active" : "Inactive";
  const statusDescription = editUserIsActive
    ? "This user can sign in and use the app."
    : "This user is blocked from using the app.";

  return (
    <Modal
      open={open}
      title="Edit staff user"
      subtitle={
        editUserEmail ? `Editing: ${editUserEmail}` : "Update user details."
      }
      onClose={() => {
        if (updateUserMutation.isPending) return;
        setShowPassword(false);
        onClose();
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Full name">
          <input
            value={editUserFullName}
            onChange={(e) => setEditUserFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>

        <Field label="Phone">
          <input
            value={editUserPhone}
            onChange={(e) => setEditUserPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          />
        </Field>

        <Field label="Role">
          <select
            value={editUserRoleId}
            onChange={(e) => setEditUserRoleId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select role…</option>
            {editRoleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.role_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <div className={`rounded-lg border p-3 ${statusBg} ${statusBorder}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`font-medium text-sm ${statusText}`}>
                  {statusLabel}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {statusDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditUserIsActive(!editUserIsActive)}
                className={`px-3 py-1 rounded-md text-xs font-medium border ${
                  editUserIsActive
                    ? "border-rose-200 text-rose-600 hover:bg-rose-100"
                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                }`}
              >
                {editUserIsActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </Field>
      </div>

      {/* Password section */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Set Password
          </span>
          <span className="text-[11px] text-slate-400">
            (leave blank to keep current)
          </span>
        </div>
        <div className="max-w-sm">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={editUserPassword}
              onChange={(e) => setEditUserPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 bg-gray-50 outline-none"
              placeholder="New password (min 6 characters)"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {updateUserMutation.isError && (
        <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-600 px-3 py-2 rounded-lg text-sm">
          {updateUserMutation.error?.message || "Failed to update user"}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (updateUserMutation.isPending) return;
            setShowPassword(false);
            onClose();
          }}
          className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          disabled={updateUserMutation.isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={updateUserMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {updateUserMutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}
