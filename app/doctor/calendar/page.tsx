"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";

type Appointment = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  patient: {
    fullName: string;
    phone: string;
  };
  service: {
    name: string;
    durationMin: string;
  };
};

const statusLabelMap: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  CANCELLED: "Цуцлагдсан",
  COMPLETED: "Дууссан",
};

export default function DoctorCalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const load = async () => {
      try {
        const response = await fetch("/api/doctor/appointments?days=14");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Календарийн мэдээллийг ачаалж чадсангүй",
          );
        setAppointments(payload.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (!mounted) {
    return null;
  }

  // Одоогийн өдрөөс эхлэн ирэх 14 өдрийг бэлтгэх
  const upcoming = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;

    return {
      date,
      key,
      entries: appointments.filter(
        (appointment) => appointment.appointmentDate.slice(0, 10) === key,
      ),
    };
  });

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <span>Календарийн мэдээллийг уншиж байна…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Захиалгын хуваарь
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Миний календарь
          </h1>
        </div>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Хянах самбар руу буцах
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map(({ date, key, entries }) => (
          <div
            key={key}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  {date.toLocaleDateString("mn-MN", { weekday: "short" })}
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {date.toLocaleDateString("mn-MN", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <CalendarRange className="h-5 w-5 text-emerald-600" />
            </div>

            <div className="space-y-2">
              {entries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500">
                  Захиалга байхгүй
                </div>
              ) : (
                entries.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <p className="text-sm font-black text-slate-900">
                      {appointment.startTime} – {appointment.endTime}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {appointment.patient.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {appointment.service.name} •{" "}
                      <span className="font-medium text-slate-600">
                        {statusLabelMap[appointment.status] ||
                          appointment.status}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
