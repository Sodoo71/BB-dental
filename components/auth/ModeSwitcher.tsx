"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function ModeSwitcher({ doctorId }: { doctorId?: string | null }) {
  const pathname = usePathname();
  const links = [{ href: "/super-admin", label: "Удирдлага" }, { href: "/admin", label: "Ресепшн" }, ...(doctorId ? [{ href: "/doctor", label: "Эмч" }] : [])];
  return <nav aria-label="Ажиллах горим" className="mb-6 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
    {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} className={`min-h-11 whitespace-nowrap rounded-lg px-5 py-3 text-xs font-medium transition ${pathname === href || pathname.startsWith(href + "/") ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</Link>)}
  </nav>;
}
