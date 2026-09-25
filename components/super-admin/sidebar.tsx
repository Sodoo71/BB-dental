"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarRange, Layers, LayoutGrid, Settings, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { Drawer } from "@/components/ui/Drawer";
import LogoutButton from "@/components/auth/LogoutButton";
import { getRoleLabel } from "@/lib/roles";
const sections = [
  { label: "Ерөнхий", items: [{ href: "/super-admin", label: "Хянах самбар", icon: LayoutGrid }, { href: "/admin", label: "Цаг захиалга", icon: CalendarRange }] },
  { label: "Удирдлага", items: [{ href: "/super-admin/services", label: "Үйлчилгээ", icon: Layers }, { href: "/super-admin/doctors", label: "Эмч нар", icon: Stethoscope }, { href: "/super-admin/users", label: "Ажилтнууд", icon: Users }, { href: "/super-admin/admins", label: "Админууд", icon: ShieldCheck }] },
  { label: "Систем", items: [{ href: "/super-admin/logs", label: "Үйлдлийн түүх", icon: Activity }, { href: "/super-admin/settings", label: "Тохиргоо", icon: Settings }] },
];
export function SuperAdminSidebar({ user, collapsed, mobileOpen, onCloseMobile }: {
  user: { id: string; name: string | null; email: string | null; role: string }; collapsed: boolean; onToggleCollapse: () => void; mobileOpen: boolean; onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const content = (compact: boolean) => <aside className="flex h-full flex-col bg-brand-700 text-white">
    <Link href="/super-admin" aria-label="BB Dental хянах самбар" className="flex h-24 items-center border-b border-white/10 px-6"><Brand dark compact={compact} /></Link>
    <nav aria-label="Админы үндсэн цэс" className="flex-1 space-y-7 overflow-y-auto px-3 py-7">
      {sections.map((section) => <div key={section.label}>{!compact && <p className="mb-2 px-3 text-[10px] font-medium tracking-widest text-brand-200">{section.label}</p>}
        <div className="space-y-1">{section.items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/super-admin" && pathname.startsWith(href + "/"));
          return <Link key={href} href={href} onClick={onCloseMobile} title={compact ? label : undefined} aria-label={compact ? label : undefined} aria-current={active ? "page" : undefined} className={`sidebar-link ${compact ? "justify-center px-0" : ""}`}><Icon size={18} className="shrink-0" />{!compact && label}</Link>;
        })}</div>
      </div>)}
    </nav>
    <div className="space-y-4 border-t border-white/10 p-4">
      {!compact && <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-sm text-gold">{(user.name || "BB").slice(0, 2)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="text-xs text-brand-200">{getRoleLabel(user.role)}</p></div></div>}
      <LogoutButton label={compact ? "Гарах" : "Системээс гарах"} />
    </div>
  </aside>;
  return <>
    <div className={`sticky top-0 hidden h-dvh shrink-0 md:block ${collapsed ? "w-24" : "w-64"}`}>{content(collapsed)}</div>
    <Drawer open={mobileOpen} onClose={onCloseMobile} label="Админы цэс">{content(false)}</Drawer>
  </>;
}
