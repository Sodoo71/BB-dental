"use client";

import Link from "next/link";
import {
  Activity,
  CalendarCheck2,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useSuperAdminData } from "@/hooks/useSuperAdminData";
import { PageHeader } from "@/components/super-admin/page-header";
import { StatCard } from "@/components/super-admin/stat-card";

export default function SuperAdminPage() {
  const { overview, doctors, users, loading, error } = useSuperAdminData();

  const totalAdmins = users.filter((user) =>
    ["ADMIN", "SUPER_ADMIN"].includes(user.role),
  ).length;

  const stats = [
    {
      title: "Total Doctors",
      value: String(overview?.totalDoctors ?? 0),
      detail: `${overview?.activeDoctors ?? 0} active doctors`,
      icon: <Stethoscope className="h-5 w-5" />,
      accent: "blue" as const,
    },
    {
      title: "Total Admins",
      value: String(totalAdmins),
      detail: "Access oversight",
      icon: <ShieldCheck className="h-5 w-5" />,
      accent: "violet" as const,
    },
    {
      title: "Total Users",
      value: String(overview?.totalPatients ?? 0),
      detail: "Registered patients",
      icon: <Users className="h-5 w-5" />,
      accent: "emerald" as const,
    },
    {
      title: "Today's Appointments",
      value: String(overview?.todayAppointments ?? 0),
      detail: `${overview?.upcomingAppointments ?? 0} upcoming`,
      icon: <CalendarCheck2 className="h-5 w-5" />,
      accent: "amber" as const,
    },
  ];

  const topDoctors = doctors.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="System overview and clinic operations snapshot."
        action={
          <Link
            href="/super-admin/doctors"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Activity className="h-4 w-4" />
            View doctors
          </Link>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            detail={stat.detail}
            icon={stat.icon}
            accent={stat.accent}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Doctor performance
              </h2>
              <p className="text-sm text-slate-500">
                Recent active roster summary
              </p>
            </div>
            <Link
              href="/super-admin/doctors"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Loading performance...</div>
          ) : (
            <div className="space-y-3">
              {topDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      {doctor.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        {doctor.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doctor.title ?? "Doctor"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {doctor.todayAppointments ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500">today</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Operations
              </h2>
              <p className="text-sm text-slate-500">Current system status</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Completed appointments
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {overview?.completedAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Cancelled</span>
              <span className="text-sm font-semibold text-slate-900">
                {overview?.cancelledAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">No-show</span>
              <span className="text-sm font-semibold text-slate-900">
                {overview?.noShowAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Doctors working today
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {overview?.doctorsWorkingToday ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
