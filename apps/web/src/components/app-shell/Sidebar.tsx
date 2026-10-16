"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertOctagon,
  BarChart3,
  Boxes,
  Building2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Cpu,
  FileText,
  LayoutGrid,
  ScrollText,
  ShieldCheck,
  Users,
  LogOut,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { performLogout } from "@/lib/auth/session";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

const managerNav: NavItem[] = [
  { href: "/manager/dashboard", labelKey: "app.dashboard", icon: <LayoutGrid className="h-4 w-4" /> },
  { href: "/manager/lines", labelKey: "app.lines", icon: <Activity className="h-4 w-4" /> },
  { href: "/manager/machines", labelKey: "app.machines", icon: <Cpu className="h-4 w-4" /> },
  { href: "/manager/work-orders", labelKey: "app.workOrders", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/manager/issues", labelKey: "app.issues", icon: <AlertOctagon className="h-4 w-4" /> },
  { href: "/manager/downtime", labelKey: "app.downtime", icon: <Clock className="h-4 w-4" /> },
  { href: "/manager/quality", labelKey: "app.quality", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/manager/reports", labelKey: "app.reports", icon: <BarChart3 className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { href: "/admin/factories", labelKey: "app.factories", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/floor", labelKey: "app.floor", icon: <Cpu className="h-4 w-4" /> },
  { href: "/admin/users", labelKey: "app.users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/shifts", labelKey: "app.shifts", icon: <Clock className="h-4 w-4" /> },
  { href: "/admin/assignments", labelKey: "app.assignments", icon: <Boxes className="h-4 w-4" /> },
  { href: "/admin/settings", labelKey: "app.settings", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/audit-log", labelKey: "app.auditLog", icon: <ScrollText className="h-4 w-4" /> },
];

export function Sidebar() {
  const path = usePathname();
  const t = useTranslations();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const isAdmin = path.startsWith("/admin");

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width]",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-3">
        {!collapsed && (
          <Link href="/manager/dashboard" className="flex items-center gap-2">
            <ThreadMark />
            <span className="font-semibold tracking-tight">SewOps</span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t("app.expand") : t("app.collapse")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
        <Group label={collapsed ? null : "Manager"} />
        {managerNav.map((it) => (
          <NavLink key={it.href} item={it} active={path === it.href} collapsed={collapsed} label={t(it.labelKey)} />
        ))}
        {isAdmin && (
          <>
            <Group label={collapsed ? null : "Admin"} className="mt-4" />
            {adminNav.map((it) => (
              <NavLink key={it.href} item={it} active={path === it.href} collapsed={collapsed} label={t(it.labelKey)} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <button
          type="button"
          onClick={() => void performLogout()}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-500",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}

function Group({ label, className }: { label: string | null; className?: string }) {
  if (!label) return null;
  return (
    <div className={cn("px-2 pb-1 pt-2 text-[10px] uppercase tracking-widest text-[var(--muted)]", className)}>
      {label}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  label,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  label: string;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-sm transition-colors",
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)]",
      )}
      title={collapsed ? label : undefined}
    >
      <span
        aria-hidden
        className={cn("inline-flex h-5 w-5 items-center justify-center", active && "text-[var(--accent)]")}
      >
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && active && (
        <span aria-hidden className="ml-auto h-5 w-[2px] rounded-full bg-[var(--accent)]" />
      )}
    </Link>
  );
}

function ThreadMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path d="M2 10 Q 6 2, 10 10 T 18 10" stroke="var(--accent)" strokeWidth="2" fill="none" />
      <circle cx="18" cy="10" r="1.5" fill="var(--accent)" />
    </svg>
  );
}
