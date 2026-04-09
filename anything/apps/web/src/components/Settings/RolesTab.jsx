import { Plus, Trash2 } from "lucide-react";
import { Field } from "./Field";
import { PERMISSION_DEFS } from "./constants";

export function RolesTab({
  roles,
  roleOptions,
  rolesLoading,
  rolesError,
  newRoleName,
  setNewRoleName,
  newRolePermissions,
  setNewRolePermissions,
  createRoleDisabled,
  onCreateRole,
  createRoleMutation,
  openEditRole,
  onDeleteRole,
  deleteRoleMutation,
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div>
        <div className="text-lg font-semibold text-slate-800">Roles</div>
        <div className="text-xs text-slate-500">
          Roles are a named set of permissions. Assign roles to staff users.
        </div>
      </div>

      {rolesLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading roles…</p>
      ) : rolesError ? (
        <p className="mt-4 text-sm text-rose-600">{rolesError}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Field label="Role name">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="e.g. Supervisor"
            list="settings-role-name-options"
          />
          <datalist id="settings-role-name-options">
            {roleOptions.map((r) => (
              <option key={r.id} value={r.role_name} />
            ))}
          </datalist>
        </Field>

        <div className="lg:col-span-2">
          <div className="text-xs font-medium text-slate-600">Permissions</div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERMISSION_DEFS.map((def) => {
              const checked = newRolePermissions?.[def.key] === true;
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
                        ...newRolePermissions,
                        [def.key]: e.target.checked,
                      };
                      setNewRolePermissions(next);
                    }}
                  />
                  <span className="text-sm text-slate-700">{def.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={createRoleDisabled}
          onClick={onCreateRole}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {createRoleMutation.isPending ? "Creating..." : "Create role"}
        </button>
      </div>

      <div className="mt-6">
        {roles.length === 0 ? (
          <p className="text-sm text-slate-500">No roles yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Permissions</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roleOptions.map((r) => {
                  const permObj =
                    r.permissions && typeof r.permissions === "object"
                      ? r.permissions
                      : {};
                  const enabledLabels = PERMISSION_DEFS.filter(
                    (d) => permObj[d.key] === true,
                  ).map((d) => d.label);
                  const enabledText =
                    enabledLabels.length > 0 ? enabledLabels.join(", ") : "—";

                  const canDelete = r.role_name !== "Admin";

                  return (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {r.role_name}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {enabledText}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditRole(r)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canDelete || deleteRoleMutation.isPending
                            }
                            onClick={() => onDeleteRole(r)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            title={
                              canDelete
                                ? "Delete"
                                : "Admin role cannot be deleted"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
