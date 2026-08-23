"use client";

import Link from "next/link";
import { ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/super-admin/page-header";
import { getRoleLabel } from "@/lib/roles";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
};

export default function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/admin/users");
        const payload = await response.json();
        if (!active) return;

        if (!response.ok) {
          setAdmins([]);
          return;
        }

        const nextAdmins = ((payload.data ?? []) as AdminRow[]).filter((user) =>
          ["SUPER_ADMIN", "ADMIN"].includes(user.role),
        );
        setAdmins(nextAdmins);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description="Manage system administrators and access rights."
        action={
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <UserCog className="h-4 w-4" />
            Admin Panel
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
          Administrator roster
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">
            Loading administrators...
          </div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No administrators found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-t border-slate-200">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {admin.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">
                            {admin.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {getRoleLabel(admin.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{admin.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          admin.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {admin.isActive ? "Active" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
