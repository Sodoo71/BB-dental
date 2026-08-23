"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

const weekdayLabels = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];

const defaultWeek = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  startTime: "09:00",
  endTime: "17:00",
  isDayOff: false,
}));

type ScheduleRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
};

export default function DoctorAvailabilityPage() {
  const [schedule, setSchedule] = useState<ScheduleRow[]>(defaultWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const load = async () => {
      try {
        const response = await fetch("/api/doctor/availability");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Ажиллах цагийн хуваарийг ачаалж чадсангүй",
          );

        const rows =
          payload.data && payload.data.length ? payload.data : defaultWeek;
        const normalized = defaultWeek.map((slot) => {
          const existing = rows.find(
            (row: ScheduleRow) => row.dayOfWeek === slot.dayOfWeek,
          );
          if (!existing) return slot;
          return {
            dayOfWeek: slot.dayOfWeek,
            startTime: existing.isDayOff
              ? "09:00"
              : existing.startTime || slot.startTime,
            endTime: existing.isDayOff
              ? "17:00"
              : existing.endTime || slot.endTime,
            isDayOff: Boolean(existing.isDayOff),
          };
        });
        setSchedule(normalized);
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

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/doctor/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Цагийн хуваарийг хадгалж чадсангүй");
      alert("Таны ажиллах цагийн хуваарь амжилттай шинэчлэгдлээ.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Цагийн хуваарь хадгалахад алдаа гарлаа.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-[28px] border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <span>Таны ажиллах цагийн хуваарийг уншиж байна…</span>
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
            Ажиллах цагийн хуваарь
          </h1>
        </div>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Хянах самбар
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`rounded-2xl border p-4 ${
              day.isDayOff
                ? "border-slate-200 bg-slate-50"
                : "border-emerald-200 bg-emerald-50/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">
                {weekdayLabels[day.dayOfWeek]}
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={day.isDayOff}
                  onChange={(event) => {
                    const isDayOff = event.target.checked;
                    setSchedule((current) =>
                      current.map((row) =>
                        row.dayOfWeek === day.dayOfWeek
                          ? {
                              ...row,
                              isDayOff,
                              startTime: isDayOff
                                ? "09:00"
                                : row.startTime || "09:00",
                              endTime: isDayOff
                                ? "17:00"
                                : row.endTime || "17:00",
                            }
                          : row,
                      ),
                    );
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Амрах өдөр
              </label>
            </div>

            {day.isDayOff ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Ажиллахгүй
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="rounded-xl border border-white bg-white p-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Эхлэх
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(event) =>
                      setSchedule((current) =>
                        current.map((row) =>
                          row.dayOfWeek === day.dayOfWeek
                            ? { ...row, startTime: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                  />
                </label>
                <label className="rounded-xl border border-white bg-white p-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Дуусах
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(event) =>
                      setSchedule((current) =>
                        current.map((row) =>
                          row.dayOfWeek === day.dayOfWeek
                            ? { ...row, endTime: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="mt-2 w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={saveSchedule}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? "Хадгалж байна…" : "Цагийн хуваарь хадгалах"}
      </button>
    </div>
  );
}
