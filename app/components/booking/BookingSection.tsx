"use client";
import React, { useMemo, useState } from "react";
import Select from "@/app/components/ui/Select";
import Info from "../ui/Info";
import Field from "../ui/Field";
import {
  UserRound,
  Stethoscope,
  CalendarDays,
  Clock3,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useDoctors from "../../../hooks/useDoctors";
import useServices from "../../../hooks/useServices";
import useAvailability from "../../../hooks/useAvailability";
import useBooking from "../../../hooks/useBooking";
import { iso, getCalendarCells, isPastDate } from "../../../lib/date";
import type { Doctor, Service } from "../../../types/booking";

export default function BookingSection() {
  const today = useMemo(() => new Date(), []);
  const { doctors, loading } = useDoctors();
  const { services } = useServices();
  const {
    open,
    setOpen,
    sending,
    setSending,
    result,
    setResult,
    form,
    setForm,
    notify,
  } = useBooking();

  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const { slots, loading: slotLoading } = useAvailability(
    doctorId,
    serviceId,
    date,
  );

  const doctor = doctors.find((x: Doctor) => x.id === doctorId);
  const service = services.find((x: Service) => x.id === serviceId);

  const cells = getCalendarCells(month);
  const slotGroups = useMemo(() => {
    const groups = [
      { label: "Morning", slots: [] as string[] },
      { label: "Afternoon", slots: [] as string[] },
      { label: "Evening", slots: [] as string[] },
    ];

    for (const slot of slots) {
      const hour = Number(slot.split(":")[0]);
      if (hour < 12) groups[0].slots.push(slot);
      else if (hour < 17) groups[1].slots.push(slot);
      else groups[2].slots.push(slot);
    }

    return groups.filter((group) => group.slots.length > 0);
  }, [slots]);

  const ready = doctorId && serviceId && date && form.startTime;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          doctorId,
          serviceId,
          appointmentDate: date,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Server error");
      setOpen(false);
      setResult({
        success: true,
        message: d.notificationSent
          ? "Захиалга бүртгэгдэж, эмчид Telegram мэдэгдэл илгээгдлээ."
          : "Захиалга амжилттай бүртгэгдлээ.",
      });
      notify(true, "Цаг амжилттай захиалагдлаа.");
      // remove booked slot locally
      // (availability hook will update when date/filters change)
      setForm({ ...form, startTime: "" });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Сервертэй холбогдож чадсангүй.";
      setResult({ success: false, message });
      notify(false, message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="booking" className="bg-slate-100/70 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <p className="text-xs font-black tracking-widest text-cyan-600">
            ОНЛАЙН ЦАГ БҮРТГЭЛ
          </p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            Захиалга хийх
          </h2>
          <p className="mt-2 text-slate-600">
            Эмч болон боломжит цагаа сонгоод захиалгаа баталгаажуулна уу.
          </p>
        </div>

        <div className="overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-slate-200">
          <div className="grid lg:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-8 p-6 sm:p-10">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  icon={<UserRound />}
                  label="Эмч сонгох"
                  value={doctorId}
                  change={setDoctorId}
                  options={doctors.map((x: Doctor) => [
                    x.id,
                    `${x.name}${x.title ? ` · ${x.title}` : ""}`,
                  ])}
                  loading={loading}
                />
                <Select
                  icon={<Stethoscope />}
                  label="Үйлчилгээ сонгох"
                  value={serviceId}
                  change={setServiceId}
                  options={services.map((x: Service) => [
                    x.id,
                    `${x.name} · ${x.durationMin} мин`,
                  ])}
                  loading={loading}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                    className="rounded-lg p-1 hover:bg-slate-100"
                  >
                    <ChevronLeft />
                  </button>
                  <b className="text-base font-black">
                    {month.getFullYear()} · {month.getMonth() + 1}-р сар
                  </b>
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                    className="rounded-lg p-1 hover:bg-slate-100"
                  >
                    <ChevronRight />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"].map((x) => (
                    <b className="p-2 text-slate-400" key={x}>
                      {x}
                    </b>
                  ))}
                  {cells.map((d: Date | null, i: number) =>
                    !d ? (
                      <span key={i} />
                    ) : (
                      <button
                        key={iso(d)}
                        disabled={isPastDate(d, today)}
                        onClick={() => setDate(iso(d))}
                        className={`mx-auto h-9 w-9 rounded-full font-bold transition ${date === iso(d) ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30" : isPastDate(d, today) ? "text-slate-300" : "hover:bg-cyan-50 text-slate-700"}`}
                      >
                        {d.getDate()}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-black text-slate-800">
                  Боломжит цагууд
                </h3>
                {slotLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                  </div>
                ) : slots.length ? (
                  <div className="space-y-5">
                    {slotGroups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-2 text-xs font-black tracking-[0.2em] text-slate-400">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {group.slots.map((x: string) => (
                            <button
                              key={x}
                              onClick={() => setForm({ ...form, startTime: x })}
                              className={`rounded-xl border py-2.5 text-sm font-bold transition ${form.startTime === x ? "border-cyan-600 bg-cyan-600 text-white shadow-md" : "border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50"}`}
                            >
                              {x}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-medium text-slate-500">
                    {doctorId && serviceId && date
                      ? "Энэ өдөр боломжит цаг байхгүй байна."
                      : "Эмч, үйлчилгээ болон өдрөө сонгоно уу."}
                  </p>
                )}
              </div>
            </div>

            <aside className="flex flex-col justify-between bg-slate-950 p-8 text-white">
              <div>
                <p className="text-xs font-bold tracking-widest text-cyan-400">
                  ТА НЫ С О Н Г О Л Т
                </p>
                <div className="mt-8 space-y-6 text-sm">
                  <Info
                    icon={<UserRound />}
                    title="Эмч"
                    value={doctor?.name ?? "Сонгоогүй"}
                  />
                  <Info
                    icon={<Stethoscope />}
                    title="Үйлчилгээ"
                    value={service?.name ?? "Сонгоогүй"}
                  />
                  <Info
                    icon={<CalendarDays />}
                    title="Өдөр"
                    value={date || "Сонгоогүй"}
                  />
                  <Info
                    icon={<Clock3 />}
                    title="Цаг"
                    value={form.startTime || "Сонгоогүй"}
                  />
                </div>
              </div>

              <div className="mt-8">
                <div className="rounded-2xl bg-white/10 p-5 text-sm backdrop-blur-md">
                  <p className="text-xs text-slate-400">Хугацаа ба Үнэ</p>
                  <p className="mt-1 text-lg font-black">
                    {service
                      ? `${service.durationMin} мин · ${service.price ? String(service.price).toLocaleString() + "₮" : "Үнэ тодорхойгүй"}`
                      : "Үйлчилгээ сонгоно уу"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    ready
                      ? setOpen(true)
                      : notify(
                          false,
                          "Эмч, үйлчилгээ, өдөр, цагаа бүрэн сонгоно уу.",
                        )
                  }
                  className="mt-4 w-full rounded-2xl bg-cyan-500 py-4 font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
                >
                  Үргэлжлүүлэх
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Patient Modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-[32px] bg-white p-8 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-cyan-600">СҮҮЛИЙН АЛХАМ</p>
                <h2 className="text-2xl font-black">Үйлчлүүлэгчийн мэдээлэл</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                X
              </button>
            </div>
            <div className="mb-6 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-950">
              <p>
                {doctor?.name} · {service?.name}
              </p>
              <p className="mt-1 text-xs text-cyan-700">
                {date} | {form.startTime}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Овог нэр *">
                <input
                  required
                  placeholder="Баатар"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label="Утасны дугаар *">
                <input
                  required
                  type="tel"
                  placeholder="9911----"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Нас">
                <input
                  type="number"
                  min="0"
                  max="150"
                  placeholder="25"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                />
              </Field>
              <Field label="Хүйс">
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="MALE">Эрэгтэй</option>
                  <option value="FEMALE">Эмэгтэй</option>
                  <option value="OTHER">Бусад</option>
                </select>
              </Field>
            </div>
            <Field label="Зовиур / Нэмэлт тайлбар">
              <textarea
                rows={3}
                placeholder="Шүд өвдөж байгаа эсвэл зовиуртай хэсгээ бичнэ үү..."
                value={form.chiefComplaint}
                onChange={(e) =>
                  setForm({ ...form, chiefComplaint: e.target.value })
                }
              />
            </Field>
            <button
              disabled={sending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 py-4 font-black text-white shadow-lg shadow-cyan-600/25 hover:bg-cyan-500"
            >
              {sending && <Loader2 className="h-5 w-5 animate-spin" />} Захиалга
              баталгаажуулах
            </button>
          </form>
        </div>
      )}

      {/* Result Modal */}
      {result && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-w-sm rounded-[32px] bg-white p-8 text-center shadow-2xl">
            {result.success ? (
              <div className="mx-auto h-16 w-16 text-cyan-500">✔</div>
            ) : (
              <div className="mx-auto h-16 w-16 text-red-500">✖</div>
            )}
            <h2 className="mt-4 text-2xl font-black">
              {result.success ? "Захиалга баталгаажлаа" : "Захиалга амжилтгүй"}
            </h2>
            <p className="mt-3 text-sm text-slate-600">{result.message}</p>
            <button
              onClick={() => setResult(null)}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 font-bold text-white shadow-lg"
            >
              Ойлголоо
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
