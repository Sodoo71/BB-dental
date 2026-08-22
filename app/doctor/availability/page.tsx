"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/doctor/availability");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Unable to load schedule");

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
        throw new Error(payload.error || "Unable to save schedule");
      alert("Your availability has been updated.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save your schedule.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        Loading your availability…
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Schedule
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            My availability
          </h1>
        </div>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`rounded-2xl border p-4 ${day.isDayOff ? "border-slate-200 bg-slate-50" : "border-emerald-200 bg-emerald-50/60"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">
                {weekdayLabels[day.dayOfWeek]}
              </span>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
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
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                />
                Day off
              </label>
            </div>

            {day.isDayOff ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Unavailable
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="rounded-xl border border-white bg-white p-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Start
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
                  End
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
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
