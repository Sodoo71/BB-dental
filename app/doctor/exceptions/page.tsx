"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type ExceptionItem = {
  id: string;
  date: string;
  type: "DAY_OFF" | "BLOCKED_RANGE" | "SCHEDULE_OVERRIDE";
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
};

const typeLabelMap: Record<string, string> = {
  BLOCKED_RANGE: "Цаг хаах",
  DAY_OFF: "Амрах өдөр / Чөлөө",
  SCHEDULE_OVERRIDE: "Цагийн хуваарь өөрчлөх",
};

export default function DoctorExceptionsPage() {
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState({
    date: "",
    type: "BLOCKED_RANGE",
    startTime: "09:00",
    endTime: "10:00",
    reason: "",
  });

  useEffect(() => {
    setMounted(true);
    setForm((current) => ({
      ...current,
      date: new Date().toISOString().slice(0, 10),
    }));
  }, []);

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

  const submit = async () => {
    try {
      const response = await fetch("/api/doctor/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Чөлөөний хүсэлт үүсгэж чадсангүй");

      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: "BLOCKED_RANGE",
        startTime: "09:00",
        endTime: "10:00",
        reason: "",
      });
      await load();
      alert("Чөлөөний хүсэлт амжилттай хадгалагдлаа.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Хүсэлт хадгалахад алдаа гарлаа.",
      );
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Та энэ хүсэлтийг устгахдаа итгэлтэй байна уу?")) return;

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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Устгахад алдаа гарлаа.");
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
            Чөлөө 
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Миний чөлөөний хүсэлтүүд
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

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-5">
        <label className="text-sm font-semibold text-slate-600">
          Огноо
          <input
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500"
          />
        </label>

        <label className="text-sm font-semibold text-slate-600">
          Төрөл
          <select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as typeof form.type,
              }))
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500"
          >
            <option value="BLOCKED_RANGE">Цаг хаах</option>
            <option value="DAY_OFF">Амрах өдөр / Чөлөө</option>
            <option value="SCHEDULE_OVERRIDE">Цагийн хуваарь өөрчлөх</option>
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-600">
          Эхлэх цаг
          <input
            type="time"
            value={form.startTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startTime: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500"
          />
        </label>

        <label className="text-sm font-semibold text-slate-600">
          Дуусах цаг
          <input
            type="time"
            value={form.endTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endTime: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500"
          />
        </label>

        <div className="flex items-end">
          <button
            onClick={submit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Нэмэх
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-3 text-lg font-black text-slate-900">
          Бүртгэлтэй чөлөө 
        </h2>
        {loading ? (
          <div className="flex items-center gap-3 p-4 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            Ачаалж байна…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
            Одоогоор бүртгэсэн чөлөө байхгүй байна.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-black text-slate-900">{item.date}</p>
                  <p className="text-sm text-slate-600">
                    {typeLabelMap[item.type] || item.type} •{" "}
                    {item.startTime || "—"}{" "}
                    {item.endTime ? `– ${item.endTime}` : ""}
                  </p>
                  {item.reason ? (
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Устгах
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
