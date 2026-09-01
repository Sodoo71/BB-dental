"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Trash2,
  User,
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
  COMPLETED: "border-blue-200 bg-blue-50 text-blue-700",
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
  });
};

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appRes, docRes] = await Promise.all([
        fetch("/api/doctor/appointments?days=60"),
        fetch("/api/doctors"),
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
      setError(
        err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateStatus = async (id: string, status: Appointment["status"]) => {
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
      showToast("Уулзалтын төлөв амжилттай шинэчлэгдлээ.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Уулзалтын төлөв шинэчлэхэд алдаа гарлаа.",
        "error",
      );
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
      await load();
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
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Үзлэгийн захиалгууд
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Миний цаг авалтууд
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Шинэчлэх
          </button>
          <Link
            href="/doctor"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Хянах самбар
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <span>Цаг авалтуудыг уншиж байна…</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error}
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Одоогоор бүртгэлтэй цаг авалт байхгүй байна.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="p-3">Үйлчлүүлэгч</th>
                <th className="p-3">Үйлчилгээ</th>
                <th className="p-3">Огноо</th>
                <th className="p-3">Цаг</th>
                <th className="p-3">Төлөв</th>
                <th className="p-3 text-right">Үйлдлүүд</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-slate-900">
                      {item.patient.fullName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.patient.phone}
                    </div>
                    {item.chiefComplaint && (
                      <div className="text-[11px] text-slate-400">
                        Зовиур: {item.chiefComplaint}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-800">
                      {item.service.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.service.durationMin} мин
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">
                    {formatDate(item.appointmentDate)}
                  </td>
                  <td className="p-3 font-bold text-emerald-700">
                    {item.startTime} - {item.endTime}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                        statusClassMap[item.status] || "bg-slate-100"
                      }`}
                    >
                      {statusLabelMap[item.status] || item.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Transfer */}
                      <button
                        type="button"
                        onClick={() => handleOpenTransfer(item)}
                        className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-purple-700 hover:bg-purple-100"
                        title="Өөр эмч рүү шилжүүлэх (Transfer)"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>

                      {/* Notes */}
                      <button
                        type="button"
                        onClick={() => handleOpenNotes(item)}
                        className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                        title="Дотоод тэмдэглэл"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>

                      {item.status === "PENDING" && (
                        <button
                          onClick={() => updateStatus(item.id, "CONFIRMED")}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          Баталгаажуулах
                        </button>
                      )}
                      {item.status === "CONFIRMED" && (
                        <button
                          onClick={() => updateStatus(item.id, "COMPLETED")}
                          className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
                        >
                          Дууссан
                        </button>
                      )}
                      {item.status !== "CANCELLED" && (
                        <button
                          onClick={() => updateStatus(item.id, "CANCELLED")}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          Цуцлах
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
