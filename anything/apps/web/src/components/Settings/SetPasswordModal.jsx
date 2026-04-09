import { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./Field";

export function SetPasswordModal({
  open,
  onClose,
  userName,
  userEmail,
  password,
  setPassword,
  onSave,
  saveMutation,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const canSave = password.trim().length >= 6 && !saveMutation.isPending;

  return (
    <Modal
      open={open}
      title="Set Password"
      subtitle={
        userEmail
          ? `Setting password for: ${userName || userEmail}`
          : "Set a new password for this user."
      }
      onClose={() => {
        if (saveMutation.isPending) return;
        setShowPassword(false);
        onClose();
      }}
    >
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-4">
        <div className="flex items-start gap-2">
          <KeyRound className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Password will be updated immediately</p>
            <p className="text-xs mt-0.5 text-amber-700">
              Please share this password with the user securely. They can use it
              to sign in with their email.
            </p>
          </div>
        </div>
      </div>

      <Field label="New password (min 6 characters)">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 bg-gray-50 outline-none"
            placeholder="Enter new password"
            autoFocus
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

      {saveMutation.isError && (
        <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-600 px-3 py-2 rounded-lg text-sm">
          {saveMutation.error?.message || "Failed to set password"}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (saveMutation.isPending) return;
            setShowPassword(false);
            onClose();
          }}
          className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          disabled={saveMutation.isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <KeyRound className="w-4 h-4" />
          {saveMutation.isPending ? "Setting..." : "Set Password"}
        </button>
      </div>
    </Modal>
  );
}
