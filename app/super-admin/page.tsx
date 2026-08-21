"use client";
import { FormEvent, useEffect, useState } from "react";
import { Plus, Save, ShieldCheck, Trash2, Users } from "lucide-react";
type Doctor = {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  telegramChatId: string | null;
  isActive: boolean;
  schedules: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isDayOff: boolean;
  }[];
};
const week = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
const blank = { name: "", title: "", phone: "", email: "", telegramChatId: "" };
export default function SuperAdmin() {
  const [doctors, setDoctors] = useState<Doctor[]>([]),
    [selected, setSelected] = useState<Doctor | null>(null),
    [form, setForm] = useState(blank),
    [notice, setNotice] = useState("");
  const load = () =>
    fetch("/api/admin/doctors")
      .then(async (r) => {
        if (!r.ok) throw Error();
        setDoctors((await r.json()).data);
      })
      .catch(() => setNotice("Мэдээлэл ачаалж чадсангүй."));
  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      const d = await r.json();
      if (!r.ok || d.data.role !== "SUPER_ADMIN") location.replace("/admin");
      else load();
    });
  }, []);
  const edit = (d?: Doctor) => {
    setSelected(d ?? null);
    setForm(
      d
        ? {
            name: d.name,
            title: d.title ?? "",
            phone: d.phone ?? "",
            email: d.email ?? "",
            telegramChatId: d.telegramChatId ?? "",
          }
        : blank,
    );
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const r = await fetch(
      selected ? `/api/admin/doctors/${selected.id}` : "/api/admin/doctors",
      {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    setNotice(r.ok ? "Амжилттай хадгаллаа." : "Хадгалах үед алдаа гарлаа.");
    if (r.ok) {
      edit();
      load();
    }
  };
  const remove = async (id: string) => {
    if (!confirm("Эмчийг устгах уу?")) return;
    const r = await fetch(`/api/admin/doctors/${id}`, { method: "DELETE" });
    setNotice(r.ok ? "Устгалаа." : "Устгах боломжгүй. Идэвхгүй болгоно уу.");
    load();
  };
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-3xl bg-slate-950 p-6 text-white">
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-400">
              SUPER ADMIN
            </p>
            <h1 className="text-3xl font-black">Системийн удирдлага</h1>
          </div>
          <ShieldCheck className="h-10 w-10 text-emerald-400" />
        </header>
        {notice && (
          <p className="mb-4 rounded-xl bg-white p-3 text-sm font-bold">
            {notice}
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex justify-between">
              <h2 className="flex gap-2 text-xl font-black">
                <Users /> Эмч нар
              </h2>
              <button
                onClick={() => edit()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
              >
                <Plus className="inline h-4" /> Нэмэх
              </button>
            </div>
            <div className="space-y-3">
              {doctors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-2xl border p-4"
                >
                  <button onClick={() => edit(d)} className="text-left">
                    <b>{d.name}</b>
                    <p className="text-xs text-slate-500">
                      {d.title || "Мэргэжил заагаагүй"} ·{" "}
                      {d.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                    </p>
                    <p className="text-xs text-emerald-700">
                      Telegram: {d.telegramChatId || "Тохируулаагүй"}
                    </p>
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="p-2 text-red-500"
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <form onSubmit={save} className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-black">
              {selected ? "Эмч засах" : "Шинэ эмч"}
            </h2>
            {Object.entries(form).map(([k, v]) => (
              <label key={k} className="mb-3 block text-sm font-bold">
                {
                  {
                    name: "Нэр *",
                    title: "Мэргэжил",
                    phone: "Утас",
                    email: "Имэйл",
                    telegramChatId: "Telegram Chat ID",
                  }[k]
                }
                <input
                  required={k === "name"}
                  value={v}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="mt-1 w-full rounded-xl border p-2.5"
                />
              </label>
            ))}
            <button className="mt-2 w-full rounded-xl bg-slate-900 py-3 font-bold text-white">
              <Save className="mr-2 inline h-4" />
              Хадгалах
            </button>
            <p className="mt-4 text-xs text-slate-500">
              Chat ID авахын тулд эмч bot руу /start илгээж, Telegram
              getUpdates-аас chat.id-г оруулна.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
