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

export default function DoctorCalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/doctor/appointments?days=14");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Unable to load calendar");
        setAppointments(payload.data || []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const upcoming = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const key = date.toISOString().slice(0, 10);

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
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        Loading calendar…
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Schedule
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            My calendar
          </h1>
        </div>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
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
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {date.toLocaleDateString("en-US", {
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
                  No bookings
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
                      {appointment.service.name} • {appointment.status}
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
