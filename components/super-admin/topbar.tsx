"use client";

import Link from "next/link";
import { Activity, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SuperAdminBreadcrumb } from "@/components/super-admin/breadcrumb";
import { SuperAdminUserMenu } from "@/components/super-admin/user-menu";

export function SuperAdminTopbar({
  user,
  onToggleSidebar,
  onToggleCollapse,
  sidebarCollapsed,
}: {
  user: { name: string | null; email: string | null; role: string };
  onToggleSidebar: () => void;
  onToggleCollapse: () => void;
  sidebarCollapsed: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white ">
      <div className="flex items-center justify-between gap-3 min-h-20 px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:inline-flex"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          <div className="min-w-0">
            <SuperAdminBreadcrumb />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/super-admin/logs" title="Үйлдлийн түүх" aria-label="Үйлдлийн түүх" className="hidden h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 sm:flex"><Activity size={18} /></Link>

          <SuperAdminUserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
