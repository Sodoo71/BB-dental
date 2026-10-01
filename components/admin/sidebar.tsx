"use client";

import React from "react";
import { Drawer } from "@/components/ui/Drawer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  CalendarCheck2,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { getRoleLabel } from "@/lib/roles";

type AdminSidebarProps = {
  user: { id: string; name: string | null; email: string | null; role: string };
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

export function AdminSidebar({
  user,
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
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
    ...(user.role === "ADMIN" || user.role === "SUPER_ADMIN"
      ? [{ id: "DOCTOR_LEAVES", label: "Эмчийн чөлөө", icon: CalendarCheck2 }]
      : []),
  ];

  const handleSelect = (id: string) => {
    if (onSelectTab) onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <aside className="flex h-full w-full flex-col justify-between rounded-2xl border border-brand-700 bg-brand-700 p-5 text-white shadow-xl overflow-y-auto xl:w-64">
      <div>
        {/* Clinic Brand & Close button on mobile */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10/20 text-accent">
              <UserCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">
                Ресепшн портал
              </p>
              <h1 className="truncate text-base font-semibold text-white">
                BB Dental Clinic
              </h1>
            </div>
          </div>
          {onCloseMobile ? (
            <button
              aria-label="Цэс хаах"
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-white xl:hidden rounded-lg hover:bg-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {/* Navigation tabs */}
        <nav className="space-y-1.5">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Үйл ажиллагааны цэс
          </div>
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleSelect(id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                  isActive
                    ? "bg-white/10 text-white shadow-[inset_3px_0_#85ded3]"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-accent" : "text-brand-200"
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}

          {["SUPER_ADMIN", "ADMIN"].includes(user.role) && (
            <div className="pt-3">
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Супер эрх
              </div>
              <Link
                href="/super-admin"
                className="flex items-center gap-3 rounded-2xl border border-brand-800/40 bg-brand-950/30 px-3.5 py-2.5 text-sm font-semibold text-brand-300 transition hover:bg-brand-900/40 hover:text-white"
              >
                <LayoutDashboard className="h-4 w-4 text-accent" />
                <span>Super Admin самбар</span>
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* User info & Logout */}
      <div className="mt-8 border-t border-slate-800 pt-5">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-900/80 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">
            {(user.name || user.email || "RC").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">
              {user.name || "Ресепшн"}
            </p>
            <p className="truncate text-[10px] text-accent">
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

  return (
    <>
      <Drawer
        open={Boolean(mobileOpen)}
        onClose={() => onCloseMobile?.()}
        label="Ресепшний цэс"
      >
        {content}
      </Drawer>

      {/* Desktop static aside */}
      <div className="sticky top-6 hidden h-[calc(100dvh-3rem)] shrink-0 xl:block">
        {content}
      </div>
    </>
  );
}
