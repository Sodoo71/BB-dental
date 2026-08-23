"use client";

import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
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
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
          </button>

          <SuperAdminUserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
