import {
  Home,
  Building,
  Users,
  DollarSign,
  Wrench,
  FileText,
  LogOut,
  User,
} from "lucide-react";

function NavItem({ href, title, active, Icon }) {
  const classes = active
    ? "flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0B1F3A] text-white shadow"
    : "flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50";

  return (
    <a href={href} className={classes} title={title}>
      <span className="w-10 flex items-center justify-center">
        <Icon className="w-7 h-5" />
      </span>
      <span className="text-base font-medium">{title}</span>
    </a>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex fixed top-16 left-0 flex-col w-56 px-3 py-4 gap-2 h-[calc(100vh-4rem)] bg-white border-r border-gray-100">
      <NavItem href="/dashboard" title="Dashboard" active={false} Icon={Home} />
      <NavItem
        href="/properties"
        title="Properties"
        active={true}
        Icon={Building}
      />
      <NavItem href="/tenants" title="Tenants" active={false} Icon={Users} />
      <NavItem
        href="/payments"
        title="Payments"
        active={false}
        Icon={DollarSign}
      />
      <NavItem
        href="/maintenance"
        title="Maintenance"
        active={false}
        Icon={Wrench}
      />
      <NavItem href="/landlords" title="Landlords" active={false} Icon={User} />
      <NavItem href="/reports" title="Reports" active={false} Icon={FileText} />

      <a
        href="/account/logout"
        className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50"
        title="Sign Out"
      >
        <span className="w-10 flex items-center justify-center">
          <LogOut className="w-7 h-5" />
        </span>
        <span className="text-base font-medium">Sign Out</span>
      </a>
    </aside>
  );
}
