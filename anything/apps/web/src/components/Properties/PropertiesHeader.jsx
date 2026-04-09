import { Building, Home, LogOut, Menu } from "lucide-react";
import ExelaLogo from "@/components/ExelaLogo";

export function PropertiesHeader({ onMenuToggle }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 md:px-6 h-16 bg-white shadow-sm">
      <button
        className="md:hidden p-2 rounded-full hover:bg-gray-100"
        onClick={onMenuToggle}
      >
        <Menu className="w-5 h-5 stroke-2 text-slate-500" />
      </button>

      <a href="/dashboard" className="flex items-center">
        <ExelaLogo variant="light" height="h-12" />
      </a>

      <div className="flex items-center gap-2">
        <a
          href="/dashboard"
          className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-slate-600"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </a>
        <a
          href="/account/logout"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </a>
      </div>
    </header>
  );
}
