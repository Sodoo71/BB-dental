"use client";
import { DialogFrame } from "@/components/ui/DialogFrame";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clinicDateKey, appointmentLabels } from "@/lib/doctor-workspace";
import {
  ArrowLeft,
  ArrowRightLeft,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  X,
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
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  chiefComplaint?: string | null;
  patient: {
    fullName: string;
    phone: string;
  };
  service: {
    name: string;
    durationMin: string;
  };
};

type DoctorOption = {
  id: string;
  name: string;
  title?: string | null;
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

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
};

export default function AppointmentWorkspace({
  selectedDate,
  onChanged,
}: {
  selectedDate?: string;
  onChanged?: () => void;
}) {
  const [date, setDate] = useState(clinicDateKey);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const notesRequest = useRef(0);
  const dateFilter = selectedDate ?? date;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringApp, setTransferringApp] = useState<Appointment | null>(
    null,
  );
  const [targetDoctorId, setTargetDoctorId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Notes modal
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activeAppForNotes, setActiveAppForNotes] =
    useState<Appointment | null>(null);
  const [notesList, setNotesList] = useState<AppointmentNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [appRes, docRes] = await Promise.all([
          fetch(
            `/api/doctor/appointments?${dateFilter ? `date=${dateFilter}` : "days=120"}`,
            { signal },
          ),
          fetch("/api/doctors", { signal }),
        ]);

        const [appData, docData] = await Promise.all([
          appRes.json(),
          docRes.json(),
        ]);

        if (!appRes.ok)
          throw new Error(
            appData.error || "Цаг авалтын мэдээллийг ачаалж чадсангүй",
          );
        setAppointments(appData.data || []);
        if (docRes.ok) setAllDoctors(docData.data || []);
      } catch (err) {
        if (signal?.aborted) return;
        setError(
          err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [dateFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const updateStatus = async (id: string, status: Appointment["status"]) => {
    if (busyId) return;
    if (
      ["CANCELLED", "NO_SHOW"].includes(status) &&
      !window.confirm(`${statusLabelMap[status]} төлөвт шилжүүлэх үү?`)
    )
      return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/doctor/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Төлөв шинэчлэхэд алдаа гарлаа");

      setAppointments((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      onChanged?.();
      showToast("Уулзалтын төлөв амжилттай шинэчлэгдлээ.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Уулзалтын төлөв шинэчлэхэд алдаа гарлаа.",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

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
      const res = await fetch(
        `/api/appointments/${transferringApp.id}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetDoctorId,
            reason: transferReason.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Шилжүүлж чадсангүй.");

      showToast(
        data.message || "Өвчтөний цагийг амжилттай шилжүүллээ.",
        "success",
      );
      setTransferModalOpen(false);
      onChanged?.();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setTransferring(false);
    }
  };

  // Notes Modal
  const handleOpenNotes = async (app: Appointment) => {
    const requestId = ++notesRequest.current;
    setNotesList([]);
    setNotesError("");
    setNotesLoading(true);
    setActiveAppForNotes(app);
    setNewNoteText("");
    setNotesModalOpen(true);
    try {
      const res = await fetch(`/api/appointments/${app.id}/notes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Тэмдэглэл уншиж чадсангүй.");
      if (requestId === notesRequest.current) setNotesList(data.data ?? []);
    } catch (error) {
      if (requestId === notesRequest.current)
        setNotesError(
          error instanceof Error ? error.message : "Тэмдэглэл уншиж чадсангүй.",
        );
    } finally {
      if (requestId === notesRequest.current) setNotesLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!activeAppForNotes || !newNoteText.trim() || savingNote || notesLoading)
      return;
    setSavingNote(true);
    try {
      const res = await fetch(
        `/api/appointments/${activeAppForNotes.id}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: newNoteText.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Тэмдэглэл хадгалж чадсангүй.");

      setNotesList((prev) => [data.data, ...prev]);
      setNewNoteText("");
      showToast("Тэмдэглэл амжилттай хадгалагдлаа.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSavingNote(false);
    }
  };

  const visible = appointments.filter(
    (item) =>
      (statusFilter === "ALL" || item.status === statusFilter) &&
      [item.patient.fullName, item.patient.phone, item.service.name].some(
        (value) => value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Үзлэгийн захиалгууд
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Миний цаг авалтууд
          </h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
          >
            <RefreshCw className="h-4 w-4" />
            Шинэчлэх
          </button>
          <Link
            href="/doctor"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
          >
            <ArrowLeft className="h-4 w-4" />
            Хянах самбар
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {selectedDate === undefined && (
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Огноо
            <input
              aria-label="Огноо"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 min-w-0 rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
        )}
        <label className="grid gap-1.5 text-xs font-medium text-slate-600">
          Төлөв
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 p-3 text-sm"
          >
            <option value="ALL">Бүх төлөв</option>
            {Object.entries(appointmentLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-600">
          Үйлчлүүлэгч хайх
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Нэр, утас, үйлчилгээ"
            className="min-h-11 rounded-xl border border-slate-200 p-3 text-sm"
          />
        </label>
      </div>
      {selectedDate === undefined && (
        <div className="flex flex-wrap gap-2">
          <button
            className="button-secondary min-h-11 px-3"
            onClick={() => setDate(clinicDateKey())}
          >
            Өнөөдөр
          </button>
          <button
            className="button-secondary min-h-11 px-3"
            onClick={() => setDate("")}
          >
            Өмнөх 60 / дараах 120 хоног
          </button>
        </div>
      )}
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 py-8 text-sm text-slate-500"
        >
          <Loader2 size={18} className="animate-spin" />
          Цагуудыг ачаалж байна…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      ) : !visible.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
          Сонгосон шүүлтэд тохирох цаг байхгүй байна.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <article
              key={item.id}
              className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-700">
                  {item.startTime}–{item.endTime}{" "}
                  <span className="ml-2 font-normal text-slate-500">
                    {formatDate(item.appointmentDate)}
                  </span>
                </p>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassMap[item.status]}`}
                >
                  {statusLabelMap[item.status]}
                </span>
              </div>
              <div>
                <h2 className="break-words text-base font-semibold text-slate-900">
                  {item.patient.fullName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {item.service.name} · {item.service.durationMin} мин
                </p>
                <a
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-4"
                  href={`tel:${item.patient.phone}`}
                >
                  {item.patient.phone} · Залгах
                </a>
                {item.chiefComplaint && (
                  <p className="mt-2 break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Зовиур: {item.chiefComplaint}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:flex sm:flex-wrap">
                <button
                  className="button-secondary min-h-12 justify-center px-3"
                  onClick={() => void handleOpenNotes(item)}
                >
                  <MessageSquare size={16} />
                  Тэмдэглэл
                </button>
                {["PENDING", "CONFIRMED"].includes(item.status) && (
                  <button
                    className="button-secondary min-h-12 justify-center px-3"
                    disabled={Boolean(busyId)}
                    onClick={() => handleOpenTransfer(item)}
                  >
                    <ArrowRightLeft size={16} />
                    Шилжүүлэх
                  </button>
                )}
                {item.status === "PENDING" && (
                  <button
                    disabled={Boolean(busyId)}
                    className="button-primary col-span-2 min-h-12 justify-center px-3 sm:col-span-1"
                    onClick={() => void updateStatus(item.id, "CONFIRMED")}
                  >
                    Баталгаажуулах
                  </button>
                )}
                {item.status === "CONFIRMED" && (
                  <>
                    <button
                      disabled={Boolean(busyId)}
                      className="button-primary col-span-2 min-h-12 justify-center px-3 sm:col-span-1"
                      onClick={() => void updateStatus(item.id, "COMPLETED")}
                    >
                      Үзлэг дуусгах
                    </button>
                    <button
                      disabled={Boolean(busyId)}
                      className="button-secondary min-h-12 justify-center px-3"
                      onClick={() => void updateStatus(item.id, "NO_SHOW")}
                    >
                      Ирээгүй
                    </button>
                  </>
                )}
                {["PENDING", "CONFIRMED"].includes(item.status) && (
                  <button
                    disabled={Boolean(busyId)}
                    className="min-h-12 rounded-xl border border-red-100 px-3 text-sm text-red-600 disabled:opacity-50"
                    onClick={() => void updateStatus(item.id, "CANCELLED")}
                  >
                    Цуцлах
                  </button>
                )}
                {busyId === item.id && (
                  <span
                    role="status"
                    className="flex items-center gap-2 text-xs text-slate-500"
                  >
                    <Loader2 size={16} className="animate-spin" />
                    Хадгалж байна…
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Transfer Modal */}
      {transferModalOpen && transferringApp && (
        <DialogFrame
          onClose={() => {
            if (!transferring) setTransferModalOpen(false);
          }}
          label="Эмч рүү шилжүүлэх"
          size="max-w-md"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-4 shadow-lg sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  Өвчтөн шилжүүлэх
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {transferringApp.patient.fullName}
                </h3>
              </div>
              <button
                aria-label="Хаах"
                type="button"
                onClick={() => {
                  if (!transferring) setTransferModalOpen(false);
                }}
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
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                >
                  <option value="">Эмч сонгох</option>
                  {allDoctors
                    .filter((d) => d.id !== transferringApp.doctorId)
                    .map((d) => (
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
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!transferring) setTransferModalOpen(false);
                }}
                className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Цуцлах
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={transferring}
                className="min-h-12 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50 sm:px-5"
              >
                {transferring ? "Шилжүүлж байна..." : "Шилжүүлэх"}
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* Notes Modal */}
      {notesModalOpen && activeAppForNotes && (
        <DialogFrame
          onClose={() => {
            if (!savingNote) {
              notesRequest.current++;
              setNotesModalOpen(false);
            }
          }}
          label="Дотоод тэмдэглэл"
          size="max-w-lg"
        >
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-4 shadow-lg sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Дотоод тэмдэглэл
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {activeAppForNotes.patient.fullName} ·{" "}
                  {activeAppForNotes.patient.phone}
                </h3>
              </div>
              <button
                aria-label="Хаах"
                type="button"
                onClick={() => {
                  if (!savingNote) {
                    notesRequest.current++;
                    setNotesModalOpen(false);
                  }
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                aria-label="Шинэ тэмдэглэл"
                maxLength={10000}
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Шинэ тэмдэглэл бичих (ж: Даралт ихтэй, эм уусан)..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={handleAddNote}
                aria-label="Тэмдэглэл хадгалах"
                disabled={
                  savingNote ||
                  notesLoading ||
                  Boolean(notesError) ||
                  !newNoteText.trim()
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50 sm:w-auto"
              >
                {savingNote ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Тэмдэглэл хадгалах
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
              {notesLoading ? (
                <p role="status">Тэмдэглэл ачаалж байна…</p>
              ) : notesError ? (
                <p role="alert" className="text-red-600">
                  {notesError}
                </p>
              ) : notesList.length === 0 ? (
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
                      <span>
                        {new Date(n.createdAt).toLocaleString("mn-MN")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  if (!savingNote) {
                    notesRequest.current++;
                    setNotesModalOpen(false);
                  }
                }}
                className="min-h-12 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white"
              >
                Хаах
              </button>
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
}
