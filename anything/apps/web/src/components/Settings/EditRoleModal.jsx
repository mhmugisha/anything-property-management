import { Save } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./Field";
import { PERMISSION_DEFS } from "./constants";

export function EditRoleModal({
  open,
  onClose,
  editRoleId,
  setEditRoleId,
  editRoleName,
  setEditRoleName,
  editRolePermissions,
  setEditRolePermissions,
  roleOptions,
  loadRoleIntoEditor,
  onSave,
  updateRoleMutation,
}) {
  const editRoleIdText = editRoleId ? String(editRoleId) : "";

  return (
    <Modal
      open={open}
      title="Edit role"
      subtitle="Select a role, then change its permissions (and optionally rename it)."
      onClose={() => {
        if (updateRoleMutation.isPending) return;
        onClose();
      }}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Role name">
          <select
            value={editRoleIdText}
            onChange={(e) => {
              const nextId = e.target.value;
              const nextRole = roleOptions.find(
                (r) => String(r.id) === String(nextId),
              );
              if (!nextRole) {
                return;
              }
              loadRoleIntoEditor(nextRole);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select role…</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.role_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Rename role (optional)">
          <input
            value={editRoleName}
            onChange={(e) => setEditRoleName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="Role name"
            disabled={!editRoleId}
          />
        </Field>

        <div>
          <div className="text-xs font-medium text-slate-600">Permissions</div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERMISSION_DEFS.map((def) => {
              const checked = editRolePermissions?.[def.key] === true;
              return (
                <label
                  key={def.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = {
                        ...editRolePermissions,
                        [def.key]: e.target.checked,
                      };
                      setEditRolePermissions(next);
                    }}
                    disabled={!editRoleId}
                  />
                  <span className="text-sm text-slate-700">{def.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (updateRoleMutation.isPending) return;
            onClose();
          }}
          className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          disabled={updateRoleMutation.isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={updateRoleMutation.isPending || !editRoleId}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {updateRoleMutation.isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}
