"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { showToast } from "@/components/ui/Toast";

type DoctorAnalytics = {
  doctor: {
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    telegramChatId: string | null;
    isActive: boolean;
    createdAt: string;
  };
  stats: {
    totalAppointments: number;
    todayAppointments: number;
    thisWeekAppointments: number;
    thisMonthAppointments: number;
    last30DaysAppointments: number;
    last90DaysAppointments: number;
    completedAppointments: number;
    pendingAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    patientsBooked: number;
    patientsSeen: number;
    workingDays: number;
    appointmentDays: number;
    completedDays: number;
    dayOffDays: number;
  };
  statusBreakdown: Record<string, number>;
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isDayOff: boolean;
  }>;
  exceptions: Array<{
    id: string;
    date: string;
    type: string;
    reason: string | null;
    isActive: boolean;
    status?: "PENDING" | "APPROVED" | "CANCELLED";
  }>;
  recentAppointments: Array<{
    id: string;
    patientName: string;
    patientPhone: string;
    serviceName: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
};

const labels = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
const appointmentStatusLabels: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцлагдсан",
  NO_SHOW: "Ирээгүй",
};
const appointmentStatusClasses: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  CONFIRMED: "bg-emerald-50 text-emerald-800",
  COMPLETED: "bg-brand-50 text-brand-700",
  CANCELLED: "bg-red-50 text-red-700",
  NO_SHOW: "bg-slate-100 text-slate-700",
};

const emptyDoctorForm = {
  name: "",
  title: "",
  phone: "",
  email: "",
  avatarUrl: "",
  telegramChatId: "",
  isActive: true,
};

export default function DoctorAnalyticsPage() {
  const params = useParams<{ doctorId: string }>();
  const doctorId = params?.doctorId ?? null;
  const [data, setData] = useState<DoctorAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyDoctorForm);

  useEffect(() => {
    if (!doctorId) return;

    void (async () => {
      try {
        const response = await fetch(`/api/super-admin/doctors/${doctorId}`);
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Аналитик мэдээллийг ачаалахад алдаа гарлаа",
          );
        setData(payload.data);
        setForm({
          name: payload.data.doctor.name ?? "",
          title: payload.data.doctor.title ?? "",
          phone: payload.data.doctor.phone ?? "",
          email: payload.data.doctor.email ?? "",
          avatarUrl: payload.data.doctor.avatarUrl ?? "",
          telegramChatId: payload.data.doctor.telegramChatId ?? "",
          isActive: payload.data.doctor.isActive ?? true,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Аналитик ачаалахад алдаа гарлаа",
        );
      }
    })();
  }, [doctorId]);

  const handleSave = async () => {
    if (!doctorId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/super-admin/doctors/${doctorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title || null,
          phone: form.phone || null,
          email: form.email || null,
          avatarUrl: form.avatarUrl || null,
          telegramChatId: form.telegramChatId || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.error || "Эмчийн мэдээллийг шинэчлэхэд алдаа гарлаа",
        );
      }

      setData((current) =>
        current
          ? {
              ...current,
              doctor: {
                ...current.doctor,
                ...payload.data,
                telegramChatId:
                  payload.data.telegramChatId ?? current.doctor.telegramChatId,
              },
            }
          : current,
      );
      setIsEditing(false);
      showToast("Эмчийн мэдээлэл амжилттай шинэчлэгдлээ!", "success");
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  const maxStatusValue = useMemo(() => {
    if (!data) return 1;
    return Math.max(...Object.values(data.statusBreakdown), 1);
  }, [data]);

  if (!data && !error) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            Аналитик мэдээллийг ачаалж байна…
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="font-sans text-2xl font-semibold text-brand-900">
            Аналитик боломжгүй байна
          </h1>
          <p className="mt-3 text-slate-600">
            {error || "Мэдээлэл олдсонгүй."}
          </p>
          <Link
            href="/super-admin"
            className="button-primary mt-5 min-h-11 px-4"
          >
            Хяналтын самбар руу буцах
          </Link>
        </div>
      </main>
    );
  }

  const { doctor, stats, schedule, exceptions, recentAppointments } = data;

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/super-admin"
                className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                <ArrowLeft className="h-4 w-4" /> Хяналтын самбар
              </Link>
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-brand-600">
                  ЭМЧИЙН АНАЛИТИК
                </p>
                <h1 className="mt-1 break-words font-sans text-2xl font-semibold text-brand-900 sm:text-3xl">
                  {doctor.name}
                </h1>
              </div>
            </div>
            <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm sm:min-w-32">
              <p className="text-brand-600">Төлөв</p>
              <p
                className={`font-bold ${doctor.isActive ? "text-emerald-700" : "text-slate-600"}`}
              >
                {doctor.isActive ? "Идэвхтэй" : "Идэвхгүй"}
              </p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Нийт цаг авалт",
              value: stats.totalAppointments,
              icon: CalendarDays,
            },
            {
              label: "Захиалсан өвчтөнүүд",
              value: stats.patientsBooked,
              icon: Users,
            },
            {
              label: "Үзүүлсэн өвчтөнүүд",
              value: stats.patientsSeen,
              icon: CheckCircle2,
            },
            { label: "Өнөөдөр", value: stats.todayAppointments, icon: Clock3 },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {item.label}
                </p>
                <item.icon className="h-5 w-5 text-brand-600" />
              </div>
              <p className="mt-5 text-2xl font-semibold text-brand-900 sm:text-3xl">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-sans text-lg font-semibold text-brand-900">
                Эмчийн профайл
              </h2>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50 sm:w-auto"
                >
                  Профайл засах
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-600">
                    <span>Нэр</span>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:bg-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600">
                    <span>Мэргэшил</span>
                    <input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:bg-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600">
                    <span>Утас</span>
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:bg-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-600">
                    <span>И-мэйл</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:bg-white"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <ImageUpload
                      label="Эмчийн профайл зураг (Profile Image Upload)"
                      value={form.avatarUrl}
                      onChange={(url) =>
                        setForm((current) => ({
                          ...current,
                          avatarUrl: url,
                        }))
                      }
                    />
                  </div>
                  <label className="space-y-2 text-sm font-medium text-slate-600 sm:col-span-2">
                    <span>Telegram чат ID</span>
                    <input
                      value={form.telegramChatId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          telegramChatId: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:bg-white"
                    />
                  </label>
                </div>

                <label className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Идэвхтэй эмч
                </label>

                <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !form.name.trim()}
                    className="button-primary min-h-12 w-full px-4 disabled:opacity-60 sm:w-auto"
                  >
                    {saving ? "Хадгалж байна..." : "Өөрчлөлтийг хадгалах"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setForm({
                        name: doctor.name,
                        title: doctor.title ?? "",
                        phone: doctor.phone ?? "",
                        email: doctor.email ?? "",
                        avatarUrl: doctor.avatarUrl ?? "",
                        telegramChatId: doctor.telegramChatId ?? "",
                        isActive: doctor.isActive,
                      });
                    }}
                    className="button-secondary min-h-12 w-full px-4 sm:w-auto"
                  >
                    Цуцлах
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Нэр
                  </p>
                  <p className="mt-2 text-xl font-semibold">{doctor.name}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Мэргэшил
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {doctor.title || "Заагаагүй"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Утас
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-700">
                    {doctor.phone || "Байхгүй"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    И-мэйл
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-700">
                    {doctor.email || "Байхгүй"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Telegram чат ID
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-700">
                    {doctor.telegramChatId || "Байхгүй"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-sans text-lg font-semibold text-brand-900">
              Төлөвийн тойм
            </h2>
            <div className="mt-5 space-y-4">
              {Object.entries(data.statusBreakdown).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                    <span>{appointmentStatusLabels[key] ?? key}</span>
                    <span className="font-bold text-brand-900">{value}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: `${Math.max((value / maxStatusValue) * 100, 6)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-sans text-lg font-semibold text-brand-900">
              Ажлын нэгтгэл
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Ажиллах өдрүүд
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.workingDays}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Цаг авалттай өдрүүд
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.appointmentDays}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Дууссан өдрүүд
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.completedDays}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Амралтын өдрүүд
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats.dayOffDays}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-sans text-lg font-semibold text-brand-900">
              Долоо хоногийн хуваарь
            </h2>
            <div className="mt-5 space-y-2">
              {schedule.map((slot) => (
                <div
                  key={slot.dayOfWeek}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2"
                >
                  <span className="font-bold text-slate-700">
                    {labels[slot.dayOfWeek]}
                  </span>
                  {slot.isDayOff ? (
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
                      АМАРНА
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-slate-600">
                      {slot.startTime} – {slot.endTime}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-sans text-lg font-semibold text-brand-900">
              Сүүлийн цаг авалтууд
            </h2>
            <div className="mt-4 space-y-3">
              {recentAppointments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Сүүлийн үед цаг авалт байхгүй байна.
                </p>
              ) : (
                recentAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">
                        {appointment.patientName}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${appointmentStatusClasses[appointment.status] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {appointmentStatusLabels[appointment.status] ??
                          appointment.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {appointment.serviceName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {appointment.appointmentDate.slice(0, 10)} ·{" "}
                      {appointment.startTime}–{appointment.endTime}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Чөлөө / Онцгой хуваарь
            </h2>
            <div className="mt-4 space-y-3">
              {exceptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Бүртгэгдсэн онцгой хуваарь эсвэл чөлөө байхгүй байна.
                </p>
              ) : (
                exceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">
                        {exception.type}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${exception.status === "PENDING" ? "bg-amber-50 text-amber-800" : exception.status === "CANCELLED" || !exception.isActive ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800"}`}
                      >
                        {exception.status === "PENDING"
                          ? "Хүлээгдэж буй"
                          : exception.status === "CANCELLED"
                            ? "Цуцалсан"
                            : exception.isActive
                              ? "Баталсан"
                              : "Идэвхгүй"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {exception.date.slice(0, 10)}
                    </p>
                    {exception.reason && (
                      <p className="mt-2 text-sm text-slate-600">
                        {exception.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
