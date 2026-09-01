"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarRange,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";
import { getRoleLabel } from "@/lib/roles";

type AdminSidebarProps = {
  user: { id: string; name: string | null; email: string | null; role: string };
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
};

export function AdminSidebar({ user, activeTab, onSelectTab }: AdminSidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const navItems = [
    { id: "APPOINTMENTS", label: "Үзлэгийн цагууд", icon: CalendarRange },
    { id: "QUICK_BOOK", label: "Шуурхай цаг бүртгэх", icon: PlusCircle },
    { id: "PATIENTS", label: "Үйлчлүүлэгчийн лавлах", icon: Users },
  ];

  return (
    <aside className="w-full shrink-0 rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl shadow-slate-200 xl:w-72">
      {/* Clinic Brand */}
      <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400">
          <UserCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
            Ресепшн портал
          </p>
          <h1 className="truncate text-base font-black text-white">
            BB Dental Clinic
          </h1>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="space-y-1.5">
        <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Ажлын цэс
        </div>
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab && onSelectTab(id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                isActive
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-slate-950" : "text-cyan-400"
                }`}
              />
              <span className="truncate">{label}</span>
            </button>
          );
        })}

        {user.role === "SUPER_ADMIN" && (
          <div className="pt-3">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Супер эрх
            </div>
            <Link
              href="/super-admin"
              className="flex items-center gap-3 rounded-2xl border border-violet-800/40 bg-violet-950/30 px-3.5 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-900/40 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4 text-violet-400" />
              <span>Super Admin самбар</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User info & Logout */}
      <div className="mt-8 border-t border-slate-800 pt-5">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-900/80 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-sm font-bold text-slate-950">
            {(user.name || user.email || "RC").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">
              {user.name || "Ресепшн"}
            </p>
            <p className="truncate text-[10px] text-cyan-400">
              {getRoleLabel(user.role)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-red-950/50 hover:text-red-300 hover:border-red-900/50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Системээс гарах
        </button>
      </div>
    </aside>
  );
}
