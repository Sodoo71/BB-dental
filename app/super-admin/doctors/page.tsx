"use client";

import Link from "next/link";
import { Activity, BadgeCheck, Plus, Stethoscope } from "lucide-react";
import { useSuperAdminData } from "@/hooks/useSuperAdminData";
import { PageHeader } from "@/components/super-admin/page-header";

export default function SuperAdminDoctorsPage() {
  const { doctors, loading } = useSuperAdminData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        description="Manage doctors and their access."
        action={
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Doctor
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-sm font-semibold text-slate-700">
            Doctor directory
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" />
            {doctors.filter((doctor) => doctor.isActive).length} active
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No doctors found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Doctor</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Appointments</th>
                  <th className="px-5 py-3 font-medium">Working days</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id} className="border-t border-slate-200">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {doctor.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">
                            {doctor.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {doctor.email ?? "No email"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {doctor.title ?? "Doctor"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          doctor.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {doctor.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        {doctor.totalAppointments ?? 0}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {doctor.workingDays ?? 0}
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
