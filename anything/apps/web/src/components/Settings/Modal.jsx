import { X } from "lucide-react";

export function Modal({ open, title, subtitle, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            {subtitle ? (
              <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
