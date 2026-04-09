import {
  Plus,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Field } from "./Field";

export function UsersTab({
  users,
  usersLoading,
  usersError,
  newUserEmail,
  setNewUserEmail,
  newUserFullName,
  setNewUserFullName,
  newUserPhone,
  setNewUserPhone,
  newUserRoleId,
  setNewUserRoleId,
  newUserPassword,
  setNewUserPassword,
  roleOptions,
  canCreateUser,
  onCreateUser,
  createUserMutation,
  openEditUser,
  onToggleActive,
  toggleActiveMutation,
  openSetPassword,
  onDeleteUser,
  deleteUserMutation,
}) {
  const [showPassword, setShowPassword] = useState(false);

  // No longer filtering out Admin role - admins can create other admins
  const createRoleOptions = roleOptions;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-800">
            Staff users
          </div>
          <div className="text-xs text-slate-500">
            Add staff with email, role, and password. They can sign in
            immediately.
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Email *">
          <input
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="name@example.com"
          />
        </Field>

        <Field label="Full name (optional)">
          <input
            value={newUserFullName}
            onChange={(e) => setNewUserFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="e.g. John Doe"
          />
        </Field>

        <Field label="Phone (optional)">
          <input
            value={newUserPhone}
            onChange={(e) => setNewUserPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="+256..."
          />
        </Field>

        <Field label="Role *">
          <select
            value={newUserRoleId}
            onChange={(e) => setNewUserRoleId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 outline-none"
          >
            <option value="">Select role…</option>
            {createRoleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.role_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Password * (min 6 characters)">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 bg-gray-50 outline-none"
              placeholder="Set initial password"
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
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onCreateUser}
          disabled={!canCreateUser}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1F3A] text-white hover:bg-[#08172c] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {createUserMutation.isPending ? "Adding..." : "Add user"}
        </button>
        {createUserMutation.isError && (
          <span className="text-sm text-rose-600">
            {createUserMutation.error?.message || "Failed to create user"}
          </span>
        )}
      </div>

      <div className="mt-6">
        {usersLoading ? (
          <p className="text-sm text-slate-500">Loading users…</p>
        ) : usersError ? (
          <p className="text-sm text-rose-600">{usersError}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">No staff users yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isActive = u.is_active !== false;
                  const statusText = isActive ? "Active" : "Inactive";
                  const statusClass = isActive
                    ? "text-emerald-700"
                    : "text-rose-700";
                  const nameText = u.full_name || "—";
                  const roleText = u.role_name || "—";

                  return (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {nameText}
                      </td>
                      <td className="py-2 pr-3">{u.email}</td>
                      <td className="py-2 pr-3">{roleText}</td>
                      <td className={`py-2 pr-3 font-medium ${statusClass}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-400"}`}
                          />
                          {statusText}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openSetPassword(u)}
                            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
                            title="Set Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="text-xs">Set Password</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteUser(u.id)}
                            disabled={deleteUserMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
