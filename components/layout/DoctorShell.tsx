"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseMedical, CalendarDays, CalendarRange, Clock3, LayoutDashboard, Menu, UserCircle2, Users } from "lucide-react";
import { Brand } from "./Brand";
import { Drawer } from "@/components/ui/Drawer";
import LogoutButton from "@/components/auth/LogoutButton";
const links = [
  { href: "/doctor", label: "Хянах самбар", icon: LayoutDashboard },
  { href: "/doctor/calendar", label: "Календарь", icon: CalendarRange },
  { href: "/doctor/appointments", label: "Үзлэгийн цагууд", icon: BriefcaseMedical },
  { href: "/doctor/patients", label: "Миний үйлчлүүлэгчид", icon: Users },
  { href: "/doctor/availability", label: "Ажиллах хуваарь", icon: CalendarDays },
  { href: "/doctor/exceptions", label: "Чөлөө, өөрчлөлт", icon: Clock3 },
  { href: "/doctor/profile", label: "Миний профайл", icon: UserCircle2 },
];
export function DoctorShell({ children, name }: { children: ReactNode; name: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navigation = <aside className="flex h-full flex-col bg-brand-700 text-white">
    <Link href="/doctor" className="flex h-24 items-center border-b border-white/10 px-6"><Brand dark /></Link>
    <nav aria-label="Эмчийн үндсэн цэс" className="flex-1 space-y-1 overflow-y-auto p-4"><p className="px-3 py-3 text-[10px] tracking-widest text-brand-200">ЭМЧИЙН АЖЛЫН ХЭСЭГ</p>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href ? "page" : undefined} className="sidebar-link"><Icon size={18} />{label}</Link>)}</nav>
    <div className="space-y-4 border-t border-white/10 p-5"><p className="truncate text-sm">{name}</p><LogoutButton /></div>
  </aside>;
  return <div className="flex min-h-dvh bg-background">
    <a className="skip-link" href="#doctor-main">Үндсэн хэсэг рүү очих</a>
    <div className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">{navigation}</div>
    <Drawer open={open} onClose={() => setOpen(false)} label="Эмчийн цэс">{navigation}</Drawer>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-8"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setOpen(true)} aria-label="Эмчийн цэс нээх" className="button-secondary px-3 lg:hidden"><Menu size={18} /></button><p className="truncate text-sm font-medium text-brand-700">{links.find((link) => link.href === pathname)?.label || "Эмчийн портал"}</p></div><Link href="/doctor/profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-parchment text-brand-700" aria-label="Миний профайл">{name.slice(0, 2)}</Link></header>
      <main id="doctor-main" tabIndex={-1} className="staff-content mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
