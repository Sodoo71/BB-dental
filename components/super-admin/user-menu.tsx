"use client";
import Link from "next/link";
import { ChevronDown, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import { getRoleLabel } from "@/lib/roles";
export function SuperAdminUserMenu({ user }: { user: { name: string | null; email: string | null; role: string } }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", keyboard); };
  }, [open]);
  return <div ref={container} className="relative min-w-0">
    <button ref={trigger} type="button" aria-label="Хэрэглэгчийн цэс" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-surface-soft text-xs font-medium text-brand-700">{(user.name || "BB").slice(0, 2)}</span><span className="hidden max-w-40 sm:block"><span className="block truncate text-sm font-medium text-slate-800">{user.name}</span><span className="block text-[11px] text-slate-500">{getRoleLabel(user.role)}</span></span><ChevronDown size={15} className="text-slate-500" /></button>
    {open && <div id={id} className="absolute right-0 z-30 mt-3 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"><p className="mb-2 truncate border-b border-slate-100 px-2 pb-3 text-xs text-slate-500">{user.email}</p><Link href="/super-admin/settings" onClick={() => setOpen(false)} className="mb-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50"><Settings size={16} />Тохиргоо</Link><LogoutButton label="Системээс гарах" /></div>}
  </div>;
}
