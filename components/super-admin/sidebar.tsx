"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getRoleLabel } from "@/lib/roles";

type SidebarSection = {
  title: string;
  items: {
    label: string;
    href: string;
    icon: LucideIcon;
  }[];
};

const navigation: SidebarSection[] = [
  {
    title: "Хяналт",
    items: [
      { label: "Самбар (Overview)", href: "/super-admin", icon: LayoutGrid },
    ],
  },
  {
    title: "Удирдлага",
    items: [
      { label: "Үйлчилгээнүүд", href: "/super-admin/services", icon: Layers },
      { label: "Эмч нар", href: "/super-admin/doctors", icon: Stethoscope },
      { label: "Админууд", href: "/super-admin/admins", icon: ShieldCheck },
      { label: "Хэрэглэгчид", href: "/super-admin/users", icon: Users },
    ],
  },
  {
    title: "Үйл ажиллагаа",
    items: [
      { label: "Захиалгууд (Ресепшн)", href: "/admin", icon: CalendarRange },
      { label: "Системийн лог", href: "/super-admin/logs", icon: Activity },
    ],
  },
  {
    title: "Систем",
    items: [
      { label: "Тохиргоо", href: "/super-admin/settings", icon: Settings },
    ],
  },
];

export function SuperAdminSidebar({
  user,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  user: { id: string; name: string | null; email: string | null; role: string };
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname() ?? "/super-admin";
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/super-admin") {
      return pathname === "/super-admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore and proceed to login.
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const sidebarContent = (
    <aside
      className={[
        "flex h-full flex-col border-r border-slate-200 bg-white/95 backdrop-blur-sm transition-all duration-200",
        collapsed ? "md:w-24" : "md:w-72",
        mobileOpen
          ? "w-72 translate-x-0"
          : "-translate-x-full md:translate-x-0",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
            SA
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Super Admin
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navigation.map((section) => (
          <div key={section.title}>
            {!collapsed ? (
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {section.title}
              </div>
            ) : null}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.label : undefined}
                    className={[
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      collapsed ? "justify-center px-0 py-2.5" : "",
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-white"
                          : "text-slate-500 group-hover:text-slate-800",
                      ].join(" ")}
                    />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {(user.name || user.email || "SA").slice(0, 2).toUpperCase()}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">
                {user.name || "System Administrator"}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {getRoleLabel(user.role)}
              </div>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
        />
      ) : null}
      <div className="fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:block">
        {sidebarContent}
      </div>
    </>
  );
}
