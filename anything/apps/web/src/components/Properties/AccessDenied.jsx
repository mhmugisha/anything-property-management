import { AlertTriangle } from "lucide-react";
import QuickLinkTile from "@/components/QuickLinkTile";

export function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-rose-500" />
          <h1 className="text-xl font-semibold text-slate-800">
            Access denied
          </h1>
        </div>
        <p className="text-slate-600">
          Your role doesn't allow property management.
        </p>
        <div className="mt-4 inline-block">
          <QuickLinkTile href="/dashboard">Back to dashboard</QuickLinkTile>
        </div>
      </div>
    </div>
  );
}
