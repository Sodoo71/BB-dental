"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  MessageSquare,
  Send,
  Stethoscope,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";

type AppointmentNote = {
  id: string;
  note: string;
  author?: string | null;
  createdAt: string;
};

type Appointment = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  chiefComplaint?: string | null;
  patient: {
    fullName: string;
    phone: string;
    age?: number | null;
    gender?: string | null;
  };
  service: {
    name: string;
    durationMin: string | number;
  };
};

type ScheduleRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
};

type AvailabilityException = {
  id: string;
  date: string;
  type: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  isActive: boolean;
};

type DoctorOption = {
  id: string;
  name: string;
  title?: string | null;
};

const weekdayLabels = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];

const statusLabelMap: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: "Хүлээгдэж буй", bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  CONFIRMED: { label: "Баталгаажсан", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  COMPLETED: { label: "Дууссан", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  CANCELLED: { label: "Цуцлагдсан", bg: "bg-red-50 border-red-200", text: "text-red-700" },
  NO_SHOW: { label: "Ирээгүй", bg: "bg-slate-100 border-slate-200", text: "text-slate-700" },
};

export default function DoctorCalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleRow[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringApp, setTransferringApp] = useState<Appointment | null>(null);
  const [targetDoctorId, setTargetDoctorId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Notes modal
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activeAppForNotes, setActiveAppForNotes] = useState<Appointment | null>(null);
  const [notesList, setNotesList] = useState<AppointmentNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appRes, availRes, excRes, docRes] = await Promise.all([
        fetch(`/api/doctor/appointments?year=${year}&month=${month}`),
        fetch("/api/doctor/availability"),
        fetch("/api/doctor/exceptions"),
        fetch("/api/doctors"),
      ]);

      const [appData, availData, excData, docData] = await Promise.all([
        appRes.json(),
        availRes.json(),
        excRes.json(),
        docRes.json(),
      ]);

      if (appRes.ok) setAppointments(appData.data ?? []);
      if (availRes.ok) setWeeklySchedule(availData.data ?? []);
      if (excRes.ok) setExceptions(excData.data ?? []);
      if (docRes.ok) setAllDoctors(docData.data ?? []);
    } catch (err) {
      console.error("Error loading doctor calendar:", err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Calendar cells generation for full month grid
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: Array<{
      dateString: string;
      dayNumber: number;
      dayOfWeek: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    } | null> = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      cells.push(null);
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      const isoKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        dateString: isoKey,
        dayNumber: day,
        dayOfWeek: dateObj.getDay(),
        isCurrentMonth: true,
        isToday: isoKey === todayStr,
      });
    }

    return cells;
  }, [month, year]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const app of appointments) {
      const key = app.appointmentDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(app);
    }
    return map;
  }, [appointments]);

  const handleStatusChange = async (id: string, newStatus: Appointment["status"]) => {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/doctor/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error();
      setAppointments((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)),
      );
      showToast("Төлөв амжилттай шинэчлэгдлээ.", "success");
    } catch {
      showToast("Төлөв өөрчлөхөд алдаа гарлаа.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDay) return [];
    return appointmentsByDate[selectedDay] ?? [];
  }, [appointmentsByDate, selectedDay]);

  const getDayStatus = (dateStr: string, dayOfWeek: number) => {
    const exc = exceptions.find(
      (e) => e.date.slice(0, 10) === dateStr && e.isActive,
    );
    if (exc) {
      if (exc.type === "DAY_OFF") return { isDayOff: true, label: "Чөлөө / Амралт", tag: "exc-off" };
      if (exc.type === "SCHEDULE_OVERRIDE")
        return { isDayOff: false, label: `${exc.startTime}–${exc.endTime}`, tag: "override" };
    }

    const weekly = weeklySchedule.find((w) => w.dayOfWeek === dayOfWeek);
    if (weekly?.isDayOff) {
      return { isDayOff: true, label: "Амралт", tag: "off" };
    }
    if (weekly) {
      return { isDayOff: false, label: `${weekly.startTime}–${weekly.endTime}`, tag: "work" };
    }

    return { isDayOff: dayOfWeek === 0 || dayOfWeek === 6, label: "09:00–18:00", tag: "default" };
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Transfer Appointment
  const handleOpenTransfer = (app: Appointment) => {
    setTransferringApp(app);
    setTargetDoctorId("");
    setTransferReason("");
    setTransferModalOpen(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferringApp || !targetDoctorId) {
      showToast("Шилжүүлэх эмчийг сонгоно уу.", "error");
      return;
    }

    setTransferring(true);
    try {
      const res = await fetch(`/api/appointments/${transferringApp.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDoctorId,
          reason: transferReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Шилжүүлж чадсангүй.");

      showToast(data.message || "Өвчтөний цагийг амжилттай шилжүүллээ.", "success");
      setTransferModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setTransferring(false);
    }
  };

  // Notes Modal
  const handleOpenNotes = async (app: Appointment) => {
    setActiveAppForNotes(app);
    setNewNoteText("");
    setNotesModalOpen(true);
    try {
      const res = await fetch(`/api/appointments/${app.id}/notes`);
      const data = await res.json();
      if (res.ok) {
        setNotesList(data.data ?? []);
      }
    } catch {
      setNotesList([]);
    }
  };

  const handleAddNote = async () => {
    if (!activeAppForNotes || !newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/appointments/${activeAppForNotes.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNoteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Тэмдэглэл хадгалж чадсангүй.");

      setNotesList((prev) => [data.data, ...prev]);
      setNewNoteText("");
      showToast("Тэмдэглэл амжилттай хадгалагдлаа.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-600">
              Эмчийн портал
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Сарын ажлын хуваарь & Календарь
          </h1>
          <p className="text-xs text-slate-500">
            Өдөр бүрийн цаг захиалгууд, өвчтөн шилжүүлэх болон дотоод тэмдэглэл
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Өнөөдөр
          </button>

          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-xl p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-xs font-black text-slate-900">
              {year} он · {month + 1}-р сар
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-xl p-1.5 text-slate-600 hover:bg-white hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Month Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Нийт захиалга
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {appointments.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Баталгаажсан
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {appointments.filter((a) => a.status === "CONFIRMED").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Дууссан үзлэг
          </p>
          <p className="mt-1 text-2xl font-black text-blue-600">
            {appointments.filter((a) => a.status === "COMPLETED").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Хүлээгдэж буй
          </p>
          <p className="mt-1 text-2xl font-black text-amber-600">
            {appointments.filter((a) => a.status === "PENDING").length}
          </p>
        </div>
      </div>

      {/* Full Monthly Grid */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-black text-slate-600">
              {weekdayLabels.map((label, idx) => (
                <div
                  key={label}
                  className={`py-3.5 ${idx === 0 || idx === 6 ? "text-amber-700 bg-amber-50/50" : ""}`}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[120px] bg-slate-50/40 p-2 sm:min-h-[135px]"
                    />
                  );
                }

                const dayApps = appointmentsByDate[cell.dateString] || [];
                const dayStatus = getDayStatus(cell.dateString, cell.dayOfWeek);

                return (
                  <div
                    key={cell.dateString}
                    onClick={() => setSelectedDay(cell.dateString)}
                    className={`group min-h-[120px] cursor-pointer p-2.5 transition sm:min-h-[135px] ${
                      cell.isToday
                        ? "bg-emerald-50/40 ring-2 ring-inset ring-emerald-500"
                        : "hover:bg-slate-50"
                    } ${selectedDay === cell.dateString ? "bg-slate-100" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                          cell.isToday
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-800"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                          dayStatus.isDayOff
                            ? "bg-slate-100 text-slate-500"
                            : dayStatus.tag === "override"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {dayStatus.label}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      {dayApps.slice(0, 2).map((app) => (
                        <div
                          key={app.id}
                          className="truncate rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold shadow-2xs hover:border-emerald-400"
                        >
                          <span className="font-bold text-emerald-700 mr-1">
                            {app.startTime}
                          </span>
                          <span className="text-slate-800">
                            {app.patient.fullName}
                          </span>
                        </div>
                      ))}

                      {dayApps.length > 2 && (
                        <div className="text-center text-[10px] font-bold text-slate-500">
                          +{dayApps.length - 2} цаг
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Day Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Өдрийн цаг захиалгууд
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  {selectedDay} ·{" "}
                  {weekdayLabels[new Date(`${selectedDay}T00:00:00`).getDay()]}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedDayAppointments.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Энэ өдөр цаг захиалга бүртгэгдээгүй байна.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayAppointments.map((app) => {
                  const sInfo = statusLabelMap[app.status] || {
                    label: app.status,
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                  };

                  return (
                    <div
                      key={app.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-slate-900">
                              {app.startTime} – {app.endTime}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${sInfo.bg} ${sInfo.text}`}
                            >
                              {sInfo.label}
                            </span>
                          </div>

                          <p className="mt-1 font-bold text-slate-800">
                            {app.patient.fullName} · {app.patient.phone}
                          </p>
                          <p className="text-xs text-slate-500">
                            Үйлчилгээ: {app.service?.name} ({app.service?.durationMin} мин)
                          </p>
                          {app.chiefComplaint && (
                            <p className="mt-1 text-xs text-slate-600 bg-white rounded-xl p-2 border border-slate-200">
                              Зовиур: {app.chiefComplaint}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0">
                          {/* Transfer Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenTransfer(app)}
                            className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-purple-700 hover:bg-purple-100"
                            title="Өөр эмч рүү шилжүүлэх (Transfer)"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>

                          {/* Notes Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenNotes(app)}
                            className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                            title="Дотоод тэмдэглэл"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>

                          {app.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.id, "CONFIRMED")}
                              disabled={updatingId === app.id}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Баталгаажуулах
                            </button>
                          )}
                          {app.status === "CONFIRMED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.id, "COMPLETED")}
                              disabled={updatingId === app.id}
                              className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              Дууссан
                            </button>
                          )}
                          {app.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(app.id, "CANCELLED")}
                              disabled={updatingId === app.id}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                            >
                              Цуцлах
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModalOpen && transferringApp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  Өвчтөн шилжүүлэх
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {transferringApp.patient.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1 font-bold text-slate-700">
                <span>Шилжүүлэн авах эмч *</span>
                <select
                  value={targetDoctorId}
                  onChange={(e) => setTargetDoctorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                >
                  <option value="">Эмч сонгох</option>
                  {allDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.title ? `(${d.title})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Шилжүүлэх шалтгаан / Зөвлөмж</span>
                <textarea
                  rows={2}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Шилжүүлэх шалтгаан..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Цуцлах
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={transferring}
                className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-50"
              >
                {transferring ? "Шилжүүлж байна..." : "Шилжүүлэх"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModalOpen && activeAppForNotes && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Дотоод тэмдэглэл
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {activeAppForNotes.patient.fullName} · {activeAppForNotes.patient.phone}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <textarea
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Шинэ тэмдэглэл бичих (ж: Даралт ихтэй, эм уусан)..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={savingNote || !newNoteText.trim()}
                className="flex items-center justify-center rounded-2xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
              {notesList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                  Тэмдэглэл бүртгэгдээгүй байна.
                </div>
              ) : (
                notesList.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <p className="text-slate-800 leading-relaxed font-medium">
                      {n.note}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{n.author || "Ажилтан"}</span>
                      <span>{new Date(n.createdAt).toLocaleString("mn-MN")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
