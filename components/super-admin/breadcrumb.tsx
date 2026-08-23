"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const labelMap: Record<string, string> = {
  "super-admin": "Super Admin",
  doctors: "Doctors",
  admins: "Admins",
  users: "Users",
  appointments: "Appointments",
  logs: "Logs",
  settings: "Settings",
  dashboard: "Dashboard",
};

export function SuperAdminBreadcrumb() {
  const pathname = usePathname() ?? "/super-admin";
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "super-admin");

  const crumbs = [{ href: "/super-admin", label: "Super Admin" }].concat(
    segments.map((segment, index) => {
      const href = `/super-admin/${segments.slice(0, index + 1).join("/")}`;
      return {
        href,
        label:
          labelMap[segment] ??
          segment
            .replace(/-/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      };
    }),
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm text-slate-500"
    >
      <Link
        href="/super-admin"
        className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:text-slate-700"
      >
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <div key={crumb.href} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-slate-400" />
            {isLast ? (
              <span className="font-medium text-slate-700">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="transition hover:text-slate-700"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
