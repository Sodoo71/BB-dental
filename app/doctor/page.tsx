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
import { clinicDateKey, clinicMinutes } from "@/lib/doctor-workspace";

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
  COMPLETED: "border-brand-200 bg-brand-50 text-brand-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  NO_SHOW: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusLabelMap: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцлагдсан",
  NO_SHOW: "Ирээгүй",
};

const toTimeLabel = (value: string) => value || "--:--";

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("mn-MN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

export default function DoctorDashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/doctor/overview");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error || "Хянах самбарын мэдээллийг татахад алдаа гарлаа",
          );
        }

        setData(payload.data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Хянах самбарыг ачааллахад алдаа гарлаа.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [reload]);

  const workingHours = useMemo(() => {
    if (!data) return "0ц 0м";
    const hours = Math.floor(data.stats.workingMinutes / 60);
    const minutes = data.stats.workingMinutes % 60;
    return `${hours}ц ${minutes}м`;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
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
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Хянах самбар боломжгүй байна
        </h1>
        <p className="mt-2 text-slate-600">
          {error || "Эмчийн мэдээлэл олдсонгүй."}
        </p>
        <button
          className="button-secondary mt-4 px-4"
          onClick={() => {
            setLoading(true);
            setReload((v) => v + 1);
          }}
        >
          Дахин ачаалах
        </button>
      </div>
    );
  }

  const greeting = clinicMinutes() < 12 * 60 ? "Өглөөний мэнд" : "Өдрийн мэнд";
  const today = new Date(`${clinicDateKey()}T00:00:00Z`);

  return (
    <div className="space-y-6">
      <header className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-600">
              Эмчийн ажиллах хэсэг
            </p>
            <h1 className="mt-2 font-sans text-2xl font-semibold text-brand-900">
              {greeting}, Др. {data.doctor.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {today.toLocaleDateString("mn-MN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
            <CalendarDays className="h-4 w-4" />
            Өнөөдрийн хуваарь бэлэн
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          {
            label: "Өнөөдрийн цаг авалт",
            value: data.stats.todayAppointments,
            icon: CalendarDays,
            tone: "text-brand-600",
          },
          {
            label: "Ирээдүйд болох",
            value: data.stats.upcoming,
            icon: Clock3,
            tone: "text-brand-600",
          },
          {
            label: "Өнөөдөр үзсэн",
            value: data.stats.completedToday,
            icon: CheckCircle2,
            tone: "text-emerald-600",
          },
          {
            label: "Хүлээгдэж буй",
            value: data.stats.pending,
            icon: AlertCircle,
            tone: "text-amber-600",
          },
          {
            label: "Өнөөдрийн ажиллах цаг",
            value: workingHours,
            icon: Stethoscope,
            tone: "text-brand-600",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex min-h-10 items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
            </div>
            <p className="mt-6 text-2xl font-semibold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-600">Өнөөдөр</p>
              <h2 className="mt-1 font-sans text-lg font-semibold text-brand-900">
                Өнөөдрийн цаг авалтууд
              </h2>
            </div>
            <Link
              href="/doctor/appointments"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Бүгдийг харах
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {data.todayAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Өнөөдөр товлосон цаг байхгүй байна.
              </div>
            ) : (
              data.todayAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {toTimeLabel(appointment.startTime)} –{" "}
                        {toTimeLabel(appointment.endTime)}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {appointment.patient.fullName}
                      </p>
                      <p className="text-sm text-slate-600">
                        {appointment.service.name}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-bold ${
                        statusClassMap[appointment.status] ??
                        "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabelMap[appointment.status] ?? appointment.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>{appointment.patient.phone}</span>
                    <span>•</span>
                    <span>{appointment.service.durationMin} мин</span>
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

        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-brand-600">
              Түргэн үйлдлүүд
            </p>
            <h2 className="mt-1 font-sans text-lg font-semibold text-brand-900">
              Анхаарах зүйлс
            </h2>
          </div>

          <div className="grid gap-3">
            {[
              ["Календарь харах", "/doctor/calendar"],
              ["Өнөөдрийн цаг авалтууд", "/doctor/appointments?filter=today"],
              ["Цагийн хуваарь тохируулах", "/doctor/availability"],
              ["Чөлөө / Чөлөөний хүсэлт нэмэх", "/doctor/exceptions"],
              ["Өвчтөнүүдийн жагсаалт", "/doctor/patients"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
              >
                <span>{label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Ирээдүйд болох цаг авалтууд
            </h2>
            <Link
              href="/doctor/appointments"
              className="text-sm font-semibold text-brand-700"
            >
              Бүх цаг авалтыг харах
            </Link>
          </div>

          <div className="space-y-3">
            {data.upcomingAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Ойрын 7 хоногт товлосон цаг байхгүй байна.
              </div>
            ) : (
              data.upcomingAppointments.slice(0, 6).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(appointment.appointmentDate)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {toTimeLabel(appointment.startTime)} •{" "}
                      {appointment.patient.fullName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <span>{appointment.service.name}</span>
                    <span>{appointment.service.durationMin} мин</span>
                    <span
                      className={`rounded-full border px-2 py-1 text-sm font-bold ${
                        statusClassMap[appointment.status] ??
                        "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabelMap[appointment.status] ?? appointment.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Миний өвчтөнүүд
            </h2>
            <Link
              href="/doctor/patients"
              className="text-sm font-semibold text-brand-700"
            >
              Бүгдийг харах
            </Link>
          </div>

          <div className="space-y-3">
            {data.patients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Одоогоор өвчтөний түүх байхгүй байна.
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
                      <p className="text-sm text-slate-500">{patient.phone}</p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2 py-1 text-sm font-bold text-brand-700">
                      {patient.totalAppointments} удаа ирсэн
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Сүүлд ирсэн: {formatDate(patient.lastAppointment)}
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
