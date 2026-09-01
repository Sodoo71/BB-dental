"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  Sparkles,
  Zap,
} from "lucide-react";
import useDoctors from "../../../hooks/useDoctors";
import useServices from "../../../hooks/useServices";
import useAvailability from "../../../hooks/useAvailability";
import useBooking from "../../../hooks/useBooking";
import { iso, getCalendarCells, isPastDate } from "../../../lib/date";
import type { Doctor, Service } from "../../../types/booking";

type SuggestionItem = {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  slot: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
};

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

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { slots, loading: slotLoading } = useAvailability(
    doctorId,
    serviceId,
    date,
  );

  const doctor = doctors.find((x: Doctor) => x.id === doctorId);
  const service = services.find((x: Service) => x.id === serviceId);

  // Fetch smart suggestions when doctor or service changes
  useEffect(() => {
    let active = true;
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const query = new URLSearchParams();
        if (doctorId) query.set("doctorId", doctorId);
        if (serviceId) query.set("serviceId", serviceId);

        const res = await fetch(`/api/availability/suggest?${query.toString()}`);
        const data = await res.json();
        if (active && res.ok && Array.isArray(data.data)) {
          setSuggestions(data.data);
        }
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoadingSuggestions(false);
      }
    };

    void fetchSuggestions();
    return () => {
      active = false;
    };
  }, [doctorId, serviceId]);

  const handleSelectSuggestion = (s: SuggestionItem) => {
    if (s.doctorId && s.doctorId !== doctorId) {
      setDoctorId(s.doctorId);
    }
    if (s.serviceId && s.serviceId !== serviceId) {
      setServiceId(s.serviceId);
    }

    setDate(s.date);
    const targetDate = new Date(`${s.date}T00:00:00`);
    setMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    setForm((prev) => ({ ...prev, startTime: s.slot }));
    notify(true, `${s.formattedDate} өдрийн ${s.slot} цаг автоматаар сонгогдлоо.`);
  };

  const cells = getCalendarCells(month);
  const slotGroups = useMemo(() => {
    const groups = [
      { label: "Өглөө (Morning)", slots: [] as string[] },
      { label: "Өдөр (Afternoon)", slots: [] as string[] },
      { label: "Орой (Evening)", slots: [] as string[] },
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
            <div className="space-y-7 p-6 sm:p-10">
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

              {/* SMART SUGGESTION BOX */}
              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50/90 to-blue-50/70 p-4.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-600 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-900">
                      Танд санал болгох боломжит цагууд
                    </span>
                  </div>
                  {loadingSuggestions && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                  )}
                </div>

                {suggestions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">
                      {doctor
                        ? `${doctor.name} эмчийн хамгийн ойрын боломжит цагууд:`
                        : "Хамгийн ойрын боломжит цагууд:"}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {suggestions.slice(0, 4).map((s, idx) => (
                        <button
                          key={`${s.date}-${s.slot}-${s.doctorId}`}
                          type="button"
                          onClick={() => handleSelectSuggestion(s)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                            date === s.date && form.startTime === s.slot
                              ? "border-cyan-600 bg-cyan-600 text-white"
                              : "border-cyan-200 bg-white text-cyan-950 hover:border-cyan-400 hover:bg-cyan-50"
                          }`}
                        >
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span>
                            {s.formattedDate} · {s.slot}
                          </span>
                          {!doctorId && (
                            <span className="text-[10px] text-cyan-700 opacity-80">
                              ({s.doctorName})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Эмч болон үйлчилгээ сонгоход ойрын боломжит цагуудыг автоматаар санал болгоно.
                  </p>
                )}
              </div>

              {/* CALENDAR */}
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
                        className={`mx-auto h-9 w-9 rounded-full font-bold transition ${
                          date === iso(d)
                            ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                            : isPastDate(d, today)
                              ? "text-slate-300"
                              : "hover:bg-cyan-50 text-slate-700"
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* SLOTS LIST */}
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
                              className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                                form.startTime === x
                                  ? "border-cyan-600 bg-cyan-600 text-white shadow-md"
                                  : "border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50"
                              }`}
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
                      ? "Энэ өдөр боломжит цаг байхгүй байна. Дээрх санал болгох цагуудаас сонгох боломжтой."
                      : "Эмч, үйлчилгээ болон өдрөө сонгоно уу."}
                  </p>
                )}
              </div>
            </div>

            {/* SIDEBAR SELECTION SUMMARY */}
            <aside className="flex flex-col justify-between bg-slate-950 p-8 text-white">
              <div>
                <p className="text-xs font-bold tracking-widest text-cyan-400">
                  ТАНЫ СОНГОЛТ
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
                      ? `${service.durationMin} мин · ${
                          service.price
                            ? String(service.price).toLocaleString() + "₮"
                            : "Үнэ тодорхойгүй"
                        }`
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
