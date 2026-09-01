"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Save, Sparkles, Zap } from "lucide-react";
import { showToast } from "@/components/ui/Toast";

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
  endTime: "18:00",
  isDayOff: dayOfWeek === 0 || dayOfWeek === 6,
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

  useEffect(() => {
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
              ? "18:00"
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

  // Quick Presets
  const applyStandardWeek = () => {
    setSchedule(
      defaultWeek.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
        isDayOff: day.dayOfWeek === 0 || day.dayOfWeek === 6, // Mon-Fri work, Sat-Sun off
      })),
    );
  };

  const applyEveryday = () => {
    setSchedule(
      defaultWeek.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
        isDayOff: false,
      })),
    );
  };

  const applyHalfDay = () => {
    setSchedule(
      defaultWeek.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startTime: "09:00",
        endTime: "14:00",
        isDayOff: day.dayOfWeek === 0 || day.dayOfWeek === 6,
      })),
    );
  };

  const copyMondayToAll = () => {
    const monday = schedule.find((s) => s.dayOfWeek === 1) || schedule[0];
    setSchedule((prev) =>
      prev.map((row) => {
        if (row.dayOfWeek === 0 || row.dayOfWeek === 6) return row; // keep weekend off
        return {
          ...row,
          startTime: monday.startTime,
          endTime: monday.endTime,
          isDayOff: false,
        };
      }),
    );
  };

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
      showToast("Таны ажиллах цагийн хуваарь амжилттай шинэчлэгдлээ.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Цагийн хуваарь хадгалахад алдаа гарлаа.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Ажлын цагийн тохиргоо
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            7 хоногийн хуваарь
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

      {/* QUICK PRESETS BANNER */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-cyan-50/70 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
            Хурдан тохируулах загварууд (1-Click Presets)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={applyStandardWeek}
            className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100"
          >
            ⚡ Дав - Баа (09:00 - 18:00, Бям-Ням Амралт)
          </button>
          <button
            type="button"
            onClick={applyEveryday}
            className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100"
          >
            ⚡ Бүх 7 өдөр (09:00 - 18:00)
          </button>
          <button
            type="button"
            onClick={applyHalfDay}
            className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100"
          >
            ⚡ Хагас цаг (09:00 - 14:00)
          </button>
          <button
            type="button"
            onClick={copyMondayToAll}
            className="flex items-center gap-1 rounded-xl border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-900 shadow-2xs hover:bg-cyan-100"
          >
            <Copy className="h-3.5 w-3.5" />
            Даваа гарагийн цагийг бүх ажлын өдөрт хуулах
          </button>
        </div>
      </div>

      {/* Grid of 7 days */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`rounded-2xl border p-4 transition ${
              day.isDayOff
                ? "border-slate-200 bg-slate-50"
                : "border-emerald-200 bg-emerald-50/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">
                {weekdayLabels[day.dayOfWeek]}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
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
                                ? "18:00"
                                : row.endTime || "18:00",
                            }
                          : row,
                      ),
                    );
                  }}
                  className="h-3.5 w-3.5 rounded text-emerald-600"
                />
                Амрах өдөр
              </label>
            </div>

            {day.isDayOff ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/70 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                Амралтын өдөр
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <label className="rounded-xl border border-white bg-white p-2">
                  <span className="text-[10px] text-slate-400 block font-bold">Эхлэх</span>
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
                    className="w-full bg-transparent font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="rounded-xl border border-white bg-white p-2">
                  <span className="text-[10px] text-slate-400 block font-bold">Дуусах</span>
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
                    className="w-full bg-transparent font-bold text-slate-800 outline-none"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={saveSchedule}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black text-white shadow-md hover:bg-slate-800 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Хадгалж байна…" : "Хуваарь хадгалах"}
        </button>
      </div>
    </div>
  );
}
