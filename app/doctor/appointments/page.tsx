"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

type Appointment = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  patient: {
    fullName: string;
    phone: string;
  };
  service: {
    name: string;
    durationMin: string;
  };
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

// Date formatting туслах функц (Hydration болон цагийн зөрүүний алдаанаас сэргийлнэ)
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/doctor/appointments?days=30");
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error || "Цаг авалтын мэдээллийг ачаалж чадсангүй",
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
      alert("Уулзалтын төлөв амжилттай шинэчлэгдлээ.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Уулзалтын төлөв шинэчлэхэд алдаа гарлаа.",
      );
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Уулзалтууд
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Миний уулзалтууд
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
          <span>Уулзалтуудыг ачаалж байна…</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error}
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Одоогийн хугацаанд уулзалт олдсонгүй.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-black text-slate-900">
                    {formatDate(appointment.appointmentDate)}
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-800">
                    {appointment.startTime} – {appointment.endTime}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {appointment.patient.fullName} • {appointment.service.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Утас: {appointment.patient.phone}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
                      statusClassMap[appointment.status] ||
                      "border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {statusLabelMap[appointment.status] || appointment.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3">
                {[
                  ["CONFIRMED", "Баталгаажуулах"],
                  ["COMPLETED", "Дууссан"],
                  ["CANCELLED", "Цуцлах"],
                  ["NO_SHOW", "Ирээгүй"],
                ].map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() =>
                      updateStatus(
                        appointment.id,
                        status as Appointment["status"],
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    {status === "COMPLETED" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
