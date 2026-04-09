import { BookOpen, Receipt, BarChart3 } from "lucide-react";

export function TabNavigation({ activeTab, onTabChange }) {
  const tabButton = (key) => {
    const isActive = activeTab === key;
    const classes = isActive
      ? "bg-[#0B1F3A] text-white"
      : "bg-white text-slate-700 hover:bg-gray-50";
    return classes;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onTabChange("accounts")}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 ${tabButton("accounts")}`}
      >
        <BookOpen className="w-4 h-4" />
        Chart of Accounts
      </button>
      <button
        onClick={() => onTabChange("journal")}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 ${tabButton("journal")}`}
      >
        <Receipt className="w-4 h-4" />
        Journal Log
      </button>
      <button
        onClick={() => onTabChange("statements")}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 ${tabButton("statements")}`}
      >
        <BarChart3 className="w-4 h-4" />
        Statements
      </button>
    </div>
  );
}
