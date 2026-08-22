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

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch("/api/doctor/appointments?days=30");
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to load appointments");
      setAppointments(payload.data || []);
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
        throw new Error(payload.error || "Unable to update status");
      setAppointments((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      alert("Appointment status updated.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update appointment status.",
      );
    }
  };

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Appointments
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            My appointments
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/doctor"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-500">
          Loading appointments…
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No appointments found in the current period.
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
                    {new Date(appointment.appointmentDate).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-800">
                    {appointment.startTime} – {appointment.endTime}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {appointment.patient.fullName} • {appointment.service.name}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassMap[appointment.status]}`}
                  >
                    {appointment.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[
                  ["CONFIRMED", "Confirm"],
                  ["COMPLETED", "Completed"],
                  ["CANCELLED", "Cancelled"],
                  ["NO_SHOW", "No-show"],
                ].map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() =>
                      updateStatus(
                        appointment.id,
                        status as Appointment["status"],
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    {status === "COMPLETED" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5" />
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
