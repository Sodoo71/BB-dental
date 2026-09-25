"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { SuperAdminSidebar } from "@/components/super-admin/sidebar";
import { SuperAdminTopbar } from "@/components/super-admin/topbar";

export function SuperAdminLayout({
  user,
  children,
}: {
  user: { id: string; name: string | null; email: string | null; role: string };
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <a className="skip-link" href="#admin-main">Үндсэн хэсэг рүү очих</a>
      <div className="flex min-h-screen">
        <SuperAdminSidebar
          user={user}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <SuperAdminTopbar
            user={user}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setMobileSidebarOpen(true)}
            onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          />

          <main id="admin-main" tabIndex={-1} className="staff-content flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
