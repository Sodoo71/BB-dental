"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Stethoscope,
} from "lucide-react";

type Appointment = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  chiefComplaint?: string | null;
  patient: {
    id: string;
    fullName: string;
    phone: string;
  };
  service: {
    id: string;
    name: string;
    durationMin: string;
  };
};

type OverviewResponse = {
  doctor: {
    id: string;
    name: string;
    title?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  stats: {
    todayAppointments: number;
    upcoming: number;
    completedToday: number;
    pending: number;
    workingMinutes: number;
  };
  todayAppointments: Appointment[];
  upcomingAppointments: Appointment[];
  patients: Array<{
    id: string;
    patientId: string;
    name: string;
    phone: string;
    totalAppointments: number;
    lastAppointment: string | null;
    nextAppointment: string | null;
  }>;
};

const statusClassMap: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-blue-200 bg-blue-50 text-blue-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  NO_SHOW: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusLabelMap: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const toTimeLabel = (value: string) => value || "--:--";

export default function DoctorDashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/doctor/overview");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load dashboard");
        }

        setData(payload.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load the dashboard.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const workingHours = useMemo(() => {
    if (!data) return "0h 0m";
    const hours = Math.floor(data.stats.workingMinutes / 60);
    const minutes = data.stats.workingMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">
          Dashboard unavailable
        </h1>
        <p className="mt-2 text-slate-600">
          {error || "Could not find your doctor data."}
        </p>
      </div>
    );
  }

  const greeting =
    new Date().getHours() < 12 ? "Good morning" : "Good afternoon";

  return (
    <div className="space-y-6">
      <header className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-600">
              Doctor workspace
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              {greeting}, Dr. {data.doctor.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <CalendarDays className="h-4 w-4" />
            Today&apos;s schedule ready
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Today&apos;s Appointments",
            value: data.stats.todayAppointments,
            icon: CalendarDays,
            tone: "text-sky-600",
          },
          {
            label: "Upcoming",
            value: data.stats.upcoming,
            icon: Clock3,
            tone: "text-violet-600",
          },
          {
            label: "Completed Today",
            value: data.stats.completedToday,
            icon: CheckCircle2,
            tone: "text-emerald-600",
          },
          {
            label: "Pending",
            value: data.stats.pending,
            icon: AlertCircle,
            tone: "text-amber-600",
          },
          {
            label: "Today&apos;s Working Hours",
            value: workingHours,
            icon: Stethoscope,
            tone: "text-cyan-600",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                {label}
              </p>
              <Icon className={`h-5 w-5 ${tone}`} />
            </div>
            <p className="mt-6 text-3xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
                Today
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-900">
                Today&apos;s appointments
              </h2>
            </div>
            <Link
              href="/doctor/appointments"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {data.todayAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No appointments scheduled today.
              </div>
            ) : (
              data.todayAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {toTimeLabel(appointment.startTime)} –{" "}
                        {toTimeLabel(appointment.endTime)}
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-800">
                        {appointment.patient.fullName}
                      </p>
                      <p className="text-sm text-slate-600">
                        {appointment.service.name}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassMap[appointment.status]}`}
                    >
                      {statusLabelMap[appointment.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{appointment.patient.phone}</span>
                    <span>•</span>
                    <span>{appointment.service.durationMin} min</span>
                    {appointment.chiefComplaint && (
                      <>
                        <span>•</span>
                        <span>{appointment.chiefComplaint}</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
              Quick actions
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              What needs attention?
            </h2>
          </div>

          <div className="grid gap-3">
            {[
              ["View Calendar", "/doctor/calendar"],
              [
                "View Today&apos;s Appointments",
                "/doctor/appointments?filter=today",
              ],
              ["Manage Availability", "/doctor/availability"],
              ["Add Exception / Leave", "/doctor/exceptions"],
              ["View Patients", "/doctor/patients"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <span>{label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">
              Upcoming appointments
            </h2>
            <Link
              href="/doctor/appointments"
              className="text-sm font-semibold text-emerald-700"
            >
              View all appointments
            </Link>
          </div>

          <div className="space-y-3">
            {data.upcomingAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No upcoming appointments in the next 7 days.
              </div>
            ) : (
              data.upcomingAppointments.slice(0, 6).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {new Date(appointment.appointmentDate).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {toTimeLabel(appointment.startTime)} •{" "}
                      {appointment.patient.fullName}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span>{appointment.service.name}</span>
                    <span>{appointment.service.durationMin} min</span>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClassMap[appointment.status]}`}
                    >
                      {statusLabelMap[appointment.status]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">My patients</h2>
            <Link
              href="/doctor/patients"
              className="text-sm font-semibold text-emerald-700"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {data.patients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No patient history yet.
              </div>
            ) : (
              data.patients.slice(0, 5).map((patient) => (
                <div
                  key={patient.patientId}
                  className="rounded-2xl border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{patient.name}</p>
                      <p className="text-xs text-slate-500">{patient.phone}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      {patient.totalAppointments} visits
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Last:{" "}
                    {patient.lastAppointment
                      ? new Date(patient.lastAppointment).toLocaleDateString(
                          "en-US",
                        )
                      : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
