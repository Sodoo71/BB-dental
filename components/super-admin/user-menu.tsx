"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserCircle2 } from "lucide-react";
import { useState } from "react";

export function SuperAdminUserMenu({
  user,
}: {
  user: { name: string | null; email: string | null; role: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore and proceed to login.
    } finally {
      setOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  const initials = (user.name || user.email || "SA")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-slate-300"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials}
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-sm font-semibold text-slate-800">
            {user.name || "System Administrator"}
          </div>
          <div className="text-[11px] text-slate-500">{user.role}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <Link
            href="/super-admin/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <UserCircle2 className="h-4 w-4" />
            Profile
          </Link>
          <Link
            href="/super-admin/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
