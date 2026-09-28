"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, RefreshCw, X } from "lucide-react";
import { showToast } from "@/components/ui/Toast";

type LeaveStatus = "PENDING" | "APPROVED";
type LeaveRequest = {
  id: string;
  date: string;
  type: "DAY_OFF" | "BLOCKED_RANGE" | "SCHEDULE_OVERRIDE";
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  status: LeaveStatus;
  doctor: { id: string; name: string; title: string | null };
};

const statusLabels: Record<LeaveStatus, string> = {
  PENDING: "Хүлээгдэж буй",
  APPROVED: "Баталсан",
};
const typeLabels: Record<LeaveRequest["type"], string> = {
  DAY_OFF: "Бүтэн өдөр амрах",
  BLOCKED_RANGE: "Цагийн хэсэг хаах",
  SCHEDULE_OVERRIDE: "Ажлын цаг өөрчлөх",
};

export function DoctorLeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<"ALL" | LeaveStatus>("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/doctor-leaves?status=ALL");
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Чөлөөний хүсэлт татаж чадсангүй.");
      setRequests(payload.data ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Чөлөөний хүсэлт татаж чадсангүй.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const updateStatus = async (
    requestItem: LeaveRequest,
    action: "APPROVE" | "CANCEL",
  ) => {
    if (busyId) return;
    if (
      action === "CANCEL" &&
      !window.confirm(`${requestItem.doctor.name} эмчийн чөлөөг цуцлах уу?`)
    )
      return;
    setBusyId(requestItem.id);
    try {
      const response = await fetch("/api/admin/doctor-leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestItem.id, action }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Чөлөөний төлөв шинэчилж чадсангүй.");
      setRequests((current) =>
        action === "CANCEL"
          ? current.filter((item) => item.id !== requestItem.id)
          : current.map((item) =>
              item.id === requestItem.id ? payload.data : item,
            ),
      );
      showToast(
        action === "APPROVE" ? "Чөлөөг баталлаа." : "Чөлөөг цуцаллаа.",
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Үйлдэл амжилтгүй боллоо.",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const visible = requests.filter(
    (item) => filter === "ALL" || item.status === filter,
  );
  const filters: Array<{ id: "ALL" | LeaveStatus; label: string }> = [
    { id: "PENDING", label: "Хүлээгдэж буй" },
    { id: "APPROVED", label: "Баталсан" },
    { id: "ALL", label: "Бүгд" },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Эмчийн чөлөөний хүсэлт
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Баталсан чөлөө хуваарьт үйлчилнэ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="button-secondary min-h-11 w-full px-3 sm:w-auto"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Шинэчлэх
        </button>
      </div>

      <div
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        role="group"
        aria-label="Чөлөөний төлөвөөр шүүх"
      >
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${filter === id ? "bg-brand-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-brand-50"}`}
          >
            {label}
            {id !== "ALL"
              ? ` (${requests.filter((item) => item.status === id).length})`
              : ""}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-2 min-h-11 underline"
          >
            Дахин оролдох
          </button>
        </div>
      ) : loading ? (
        <p
          role="status"
          className="flex items-center gap-2 py-8 text-sm text-slate-500"
        >
          <RefreshCw size={16} className="animate-spin" />
          Ачаалж байна…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          <CalendarClock className="mx-auto mb-2" size={22} />
          Энэ төлөвт хүсэлт алга.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((item) => (
            <article
              key={item.id}
              className="min-w-0 rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-slate-900">
                    {item.doctor.name}
                  </h3>
                  {item.doctor.title && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      {item.doctor.title}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "PENDING" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                >
                  {statusLabels[item.status]}
                </span>
              </div>
              <div className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <CalendarClock
                  size={17}
                  className="mt-0.5 shrink-0 text-brand-600"
                />
                <div>
                  <p className="font-semibold">
                    {item.date.slice(0, 10)} · {typeLabels[item.type]}
                  </p>
                  {item.startTime && item.endTime && (
                    <p className="mt-0.5 text-slate-500">
                      {item.startTime}–{item.endTime}
                    </p>
                  )}
                </div>
              </div>
              {item.reason && (
                <p className="mt-3 break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  {item.reason}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                {item.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void updateStatus(item, "APPROVE")}
                    className="button-primary min-h-12 w-full px-3"
                  >
                    <Check size={17} />
                    {busyId === item.id ? "Боловсруулж байна…" : "Батлах"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => void updateStatus(item, "CANCEL")}
                  className={`${item.status === "PENDING" ? "" : "col-span-2"} inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50`}
                >
                  <X size={17} />
                  Цуцлах
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
