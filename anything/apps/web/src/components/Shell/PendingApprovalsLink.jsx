import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";

export function PendingApprovalsLink({ isAdmin, enabled }) {
  const count = usePendingApprovalsCount(isAdmin, enabled);

  if (!isAdmin) return null;

  return (
    <a
      href="/approvals"
      className="flex items-center justify-between px-4 py-2.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors text-sm font-medium"
    >
      <span>Pending Approvals</span>
      {count > 0 && (
        <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </a>
  );
}
