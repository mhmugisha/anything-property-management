import { ShieldAlert } from "lucide-react";
import QuickLinkTile from "@/components/QuickLinkTile";

export default function AccessDenied({ title, message }) {
  const finalTitle = title || "Access denied";
  const finalMessage =
    message || "You don't have permission to view this page.";

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 mb-4">
          <ShieldAlert className="w-7 h-7 text-rose-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">
          {finalTitle}
        </h1>
        <p className="text-slate-600">{finalMessage}</p>
        <div className="mt-6 inline-block">
          <QuickLinkTile href="/dashboard">Back to Dashboard</QuickLinkTile>
        </div>
      </div>
    </div>
  );
}
