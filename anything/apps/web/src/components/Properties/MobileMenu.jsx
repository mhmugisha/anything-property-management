import {
  Home,
  Building,
  Users,
  DollarSign,
  Wrench,
  FileText,
  LogOut,
  X,
  User,
} from "lucide-react";

export function MobileMenu({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-20 md:hidden">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      ></div>
      <div className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg">
        <div className="p-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="px-4 space-y-2">
          <a
            href="/dashboard"
            className="flex items-center px-4 py-3 text-slate-600 hover:bg-gray-50 rounded-lg"
          >
            <Home className="w-5 h-5 mr-3" />
            Dashboard
          </a>
          <a
            href="/properties"
            className="flex items-center px-4 py-3 text-[#0B1F3A] bg-sky-50 rounded-lg"
          >
            <Building className="w-5 h-5 mr-3" />
            Properties
          </a>
          <a
            href="/landlords"
            className="flex items-center px-4 py-3 text-slate-600 hover:bg-gray-50 rounded-lg"
          >
            <User className="w-5 h-5 mr-3" />
            Landlords
          </a>
          <a
            href="/tenants"
            className="flex items-center px-4 py-3 text-slate-600 hover:bg-gray-50 rounded-lg"
          >
            <Users className="w-5 h-5 mr-3" />
            Tenants
          </a>
          <a
            href="/payments"
            className="flex items-center px-4 py-3 text-slate-600 hover:bg-gray-50 rounded-lg"
          >
            <DollarSign className="w-5 h-5 mr-3" />
            Payments
          </a>
          <a
            href="/maintenance"
            className="flex items-center px-4 py-3 text-slate-600 hover:bg-gray-50 rounded-lg"
          >
            <Wrench className="w-5 h-5 mr-3" />
            Maintenance
          </a>
          <a
            href="/reports"
            className="flex items-center px-4 py-3 text-slate-600 hover:bg-gray-50 rounded-lg"
          >
            <FileText className="w-5 h-5 mr-3" />
            Reports
          </a>
          <a
            href="/account/logout"
            className="flex items-center px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-lg mt-4"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </a>
        </nav>
      </div>
    </div>
  );
}
