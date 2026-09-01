"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarOff, Clock, Plus, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/Toast";

type ExceptionItem = {
  id: string;
  date: string;
  type: "DAY_OFF" | "BLOCKED_RANGE" | "SCHEDULE_OVERRIDE";
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
};

const typeLabelMap: Record<string, { label: string; color: string }> = {
  DAY_OFF: { label: "Бүтэн өдөр амрах", color: "bg-red-100 text-red-700 border-red-200" },
  BLOCKED_RANGE: { label: "Зарим цагийг хаах", color: "bg-amber-100 text-amber-800 border-amber-200" },
  SCHEDULE_OVERRIDE: { label: "Ажлын цаг өөрчлөх", color: "bg-blue-100 text-blue-700 border-blue-200" },
};

export default function DoctorExceptionsPage() {
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "DAY_OFF" as "DAY_OFF" | "BLOCKED_RANGE" | "SCHEDULE_OVERRIDE",
    startTime: "09:00",
    endTime: "13:00",
    reason: "",
  });

  const load = async () => {
    try {
      const response = await fetch("/api/doctor/exceptions");
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error || "Чөлөөний хүсэлтийн жагсаалтыг ачаалж чадсангүй",
        );
      setItems(payload.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/doctor/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          reason: form.reason.trim() || (form.type === "DAY_OFF" ? "Бүтэн өдрийн амралт/чөлөө" : "Тусгай цагийн чөлөө"),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Чөлөөний хүсэлт үүсгэж чадсангүй");

      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: "DAY_OFF",
        startTime: "09:00",
        endTime: "13:00",
        reason: "",
      });
      await load();
      showToast("Чөлөөний хүсэлт амжилттай бүртгэгдлээ.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Хүсэлт хадгалахад алдаа гарлаа.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Та энэ чөлөөг устгахдаа итгэлтэй байна уу?")) return;

    try {
      const response = await fetch(
        `/api/doctor/exceptions?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Устгахад алдаа гарлаа");
      setItems((current) => current.filter((item) => item.id !== id));
      showToast("Чөлөө амжилттай устгагдлаа.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Устгахад алдаа гарлаа.", "error");
    }
  };

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Чөлөө & Онцгой хуваарь
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Чөлөө бүртгэх
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

      {/* Creation form */}
      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-slate-700 space-y-1">
            <span>Огноо *</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
            />
          </label>

          <label className="text-xs font-bold text-slate-700 space-y-1">
            <span>Төрөл *</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as typeof form.type,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
            >
              <option value="DAY_OFF">Бүтэн өдөр амрах (Day Off)</option>
              <option value="BLOCKED_RANGE">Зарим цагийг хаах (Blocked Hours)</option>
              <option value="SCHEDULE_OVERRIDE">Ажлын цаг өөрчлөх (Override)</option>
            </select>
          </label>

          {form.type !== "DAY_OFF" ? (
            <>
              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Эхлэх цаг</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                />
              </label>

              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Дуусах цаг</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
                />
              </label>
            </>
          ) : (
            <div className="sm:col-span-2 flex items-center p-3 rounded-xl bg-white/70 border border-slate-200 text-xs text-slate-500 font-medium">
              💡 Энэ өдөр бүтэн өдрийн турш цаг захиалга авахгүй амрах төлөвт шилжинэ.
            </div>
          )}

          <label className="sm:col-span-2 lg:col-span-3 text-xs font-bold text-slate-700 space-y-1">
            <span>Шалтгаан / Тайлбар</span>
            <input
              type="text"
              placeholder="Жишээ: Эрүүл мэндийн чөлөө, Сургалт семинар..."
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {submitting ? "Бүртгэж байна..." : "Чөлөө бүртгэх"}
            </button>
          </div>
        </div>
      </form>

      {/* List of active exceptions */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900">
          Бүртгэлтэй чөлөө ба онцгой хуваариуд
        </h2>

        {loading ? (
          <div className="flex items-center gap-3 p-6 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            Ачаалж байна…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
            Одоогоор бүртгэсэн чөлөө байхгүй байна.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const typeInfo = typeLabelMap[item.type] || {
                label: item.type,
                color: "bg-slate-100 text-slate-700 border-slate-200",
              };

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">
                        {item.date}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${typeInfo.color}`}
                      >
                        {typeInfo.label}
                      </span>
                    </div>

                    {item.startTime && item.endTime && item.type !== "DAY_OFF" && (
                      <p className="mt-1 text-xs font-semibold text-slate-700">
                        ⏱ Цаг: {item.startTime} – {item.endTime}
                      </p>
                    )}

                    {item.reason && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Шалтгаан: {item.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-slate-200/60 pt-2">
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Цуцлах / Устгах
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
