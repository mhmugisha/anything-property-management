import { Lock } from "lucide-react";

export function NoRecordPermissionNote({ className = "" }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 ${className}`}
      data-no-print="true"
    >
      <Lock className="w-4 h-4 flex-shrink-0 text-slate-400" />
      You don't have permission to record payments.
    </div>
  );
}
