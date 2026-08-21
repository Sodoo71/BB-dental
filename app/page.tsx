"use client";

import {
  FormEvent,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Stethoscope,
  UserRound,
  XCircle,
} from "lucide-react";

type Doctor = { id: string; name: string; title: string | null };
type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: string | number | null;
};
type Toast = { success: boolean; message: string } | null;
const names = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Home() {
  const today = useMemo(() => new Date(), []);
  const [doctors, setDoctors] = useState<Doctor[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [doctorId, setDoctorId] = useState(""),
    [serviceId, setServiceId] = useState(""),
    [date, setDate] = useState(""),
    [month, setMonth] = useState(
      new Date(today.getFullYear(), today.getMonth(), 1),
    ),
    [slots, setSlots] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [slotLoading, setSlotLoading] = useState(false),
    [open, setOpen] = useState(false),
    [sending, setSending] = useState(false),
    [toast, setToast] = useState<Toast>(null),
    [result, setResult] = useState<Toast>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    age: "",
    gender: "MALE",
    startTime: "",
    chiefComplaint: "",
  });
  const doctor = doctors.find((x) => x.id === doctorId),
    service = services.find((x) => x.id === serviceId);
  const notify = (success: boolean, message: string) => {
    setToast({ success, message });
    window.setTimeout(() => setToast(null), 3500);
  };
  useEffect(() => {
    void Promise.all([fetch("/api/doctors"), fetch("/api/services")])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw Error();
        setDoctors((await a.json()).data ?? []);
        setServices((await b.json()).data ?? []);
      })
      .catch(() => notify(false, "Мэдээлэл ачаалж чадсангүй."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    startTransition(() => {
      setSlots([]);
      setForm((x) => ({ ...x, startTime: "" }));
    });
    if (!doctorId || !serviceId || !date) return;
    let live = true;
    startTransition(() => setSlotLoading(true));
    void fetch(
      `/api/availability?${new URLSearchParams({ doctorId, serviceId, date })}`,
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (live) startTransition(() => setSlots(data.data ?? []));
      })
      .catch(() => live && notify(false, "Сул цагийг ачаалж чадсангүй."))
      .finally(() => live && startTransition(() => setSlotLoading(false)));
    return () => {
      live = false;
    };
  }, [doctorId, serviceId, date]);
  const submit = async (e: FormEvent) => {
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
      if (!r.ok) throw Error(d.error);
      setOpen(false);
      setResult({
        success: true,
        message: d.notificationSent
          ? "Захиалга бүртгэгдэж, эмчид Telegram мэдэгдэл илгээгдлээ."
          : "Захиалга амжилттай бүртгэгдлээ.",
      });
      notify(true, "Цаг амжилттай захиалагдлаа.");
      setSlots((x) => x.filter((t) => t !== form.startTime));
      setForm({
        fullName: "",
        phone: "",
        age: "",
        gender: "MALE",
        startTime: "",
        chiefComplaint: "",
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Сервертэй холбогдож чадсангүй.";
      setResult({ success: false, message });
      notify(false, message);
    } finally {
      setSending(false);
    }
  };
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    cells = Array.from({ length: first.getDay() + count }, (_, i) =>
      i < first.getDay()
        ? null
        : new Date(
            month.getFullYear(),
            month.getMonth(),
            i - first.getDay() + 1,
          ),
    );
  const ready = doctorId && serviceId && date && form.startTime;
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-br from-emerald-950 to-teal-700 px-4 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-widest text-emerald-300">
            SMILECARE · ONLINE BOOKING
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black sm:text-6xl">
            Цагаа өөрөө сонго.
            <br />
            <span className="text-emerald-300">Тайван ир.</span>
          </h1>
          <p className="mt-5 max-w-xl text-emerald-50">
            Эмчийн бодит хуваарьтай уялдсан, найдвартай онлайн захиалга.
          </p>
        </div>
      </header>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[80] flex max-w-sm gap-3 rounded-2xl border p-4 text-sm font-bold shadow-xl ${toast.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
        >
          {toast.success ? <CheckCircle2 /> : <XCircle />}
          {toast.message}
        </div>
      )}
      <section className="mx-auto -mt-8 max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-2xl">
          <div className="grid lg:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-8 p-6 sm:p-9">
              <h2 className="text-2xl font-black">Цаг захиалах</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  icon={<UserRound />}
                  label="Эмч"
                  value={doctorId}
                  change={setDoctorId}
                  options={doctors.map((x) => [
                    x.id,
                    `${x.name}${x.title ? ` · ${x.title}` : ""}`,
                  ])}
                  loading={loading}
                />
                <Select
                  icon={<Stethoscope />}
                  label="Үйлчилгээ"
                  value={serviceId}
                  change={setServiceId}
                  options={services.map((x) => [
                    x.id,
                    `${x.name} · ${x.durationMin} мин`,
                  ])}
                  loading={loading}
                />
              </div>
              <div className="rounded-2xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                  >
                    <ChevronLeft />
                  </button>
                  <b>
                    {month.getFullYear()} · {month.getMonth() + 1} сар
                  </b>
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                  >
                    <ChevronRight />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {names.map((x) => (
                    <b className="p-2 text-slate-400" key={x}>
                      {x}
                    </b>
                  ))}
                  {cells.map((d, i) =>
                    !d ? (
                      <span key={i} />
                    ) : (
                      <button
                        key={iso(d)}
                        disabled={
                          d <
                          new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            today.getDate(),
                          )
                        }
                        onClick={() => setDate(iso(d))}
                        className={`mx-auto h-9 w-9 rounded-full font-bold ${date === iso(d) ? "bg-emerald-600 text-white" : d < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? "text-slate-300" : "hover:bg-emerald-50"}`}
                      >
                        {d.getDate()}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-black">Боломжит цаг</h3>
                {slotLoading ? (
                  <Loader2 className="animate-spin text-emerald-600" />
                ) : slots.length ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((x) => (
                      <button
                        onClick={() => setForm({ ...form, startTime: x })}
                        className={`rounded-xl border py-2 text-sm font-bold ${form.startTime === x ? "border-emerald-600 bg-emerald-600 text-white" : "hover:border-emerald-400"}`}
                        key={x}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    Эмч, үйлчилгээ, өдрөө сонгоход сул цаг гарна.
                  </p>
                )}
              </div>
            </div>
            <aside className="bg-slate-950 p-7 text-white">
              <p className="text-xs font-bold tracking-widest text-emerald-400">
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
              <p className="mt-8 rounded-xl bg-white/10 p-4 text-sm">
                {service
                  ? `${service.durationMin} минут · ${service.price ? Number(service.price).toLocaleString() + "₮" : "Үнэ тодорхойгүй"}`
                  : "Үйлчилгээ сонгоно уу"}
              </p>
              <button
                onClick={() =>
                  ready
                    ? setOpen(true)
                    : notify(false, "Эмч, үйлчилгээ, өдөр, цагаа сонгоно уу.")
                }
                className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-black hover:bg-emerald-400"
              >
                Үргэлжлүүлэх
              </button>
            </aside>
          </div>
        </div>
      </section>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-lg rounded-[28px] bg-white p-7 shadow-2xl"
          >
            <div className="mb-5 flex justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600">
                  СҮҮЛИЙН АЛХАМ
                </p>
                <h2 className="text-2xl font-black">Таны мэдээлэл</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                <XCircle />
              </button>
            </div>
            <p className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm">
              <b>{doctor?.name}</b> · {service?.name} · {date} {form.startTime}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Овог нэр *">
                <input
                  required
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label="Утас *">
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Нас">
                <input
                  type="number"
                  min="0"
                  max="150"
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
            <Field label="Зовиур / тайлбар">
              <textarea
                rows={3}
                value={form.chiefComplaint}
                onChange={(e) =>
                  setForm({ ...form, chiefComplaint: e.target.value })
                }
              />
            </Field>
            <button
              disabled={sending}
              className="mt-3 flex w-full justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-black text-white"
            >
              {sending && <Loader2 className="animate-spin" />}Захиалгаа батлах
            </button>
          </form>
        </div>
      )}
      {result && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4">
          <div className="max-w-sm rounded-[28px] bg-white p-8 text-center shadow-2xl">
            {result.success ? (
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            ) : (
              <XCircle className="mx-auto h-14 w-14 text-red-500" />
            )}
            <h2 className="mt-4 text-2xl font-black">
              {result.success ? "Захиалга баталгаажлаа" : "Захиалга амжилтгүй"}
            </h2>
            <p className="mt-3 text-sm text-slate-600">{result.message}</p>
            <button
              onClick={() => setResult(null)}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
            >
              Ойлголоо
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
function Select({
  icon,
  label,
  value,
  change,
  options,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: (x: string) => void;
  options: string[][];
  loading: boolean;
}) {
  return (
    <label className="rounded-2xl border p-3 text-sm">
      <span className="mb-1 flex gap-2 text-xs font-bold text-emerald-600">
        {icon}
        {label}
      </span>
      <select
        disabled={loading}
        value={value}
        onChange={(e) => change(e.target.value)}
        className="w-full bg-transparent font-bold outline-none"
      >
        <option value="">Сонгох</option>
        {options.map(([v, l]) => (
          <option value={v} key={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Info({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-emerald-400">{icon}</span>
      <p>
        <span className="block text-xs text-slate-400">{title}</span>
        <b>{value}</b>
      </p>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block text-sm font-bold">
      {label}
      <span className="mt-1 block [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:p-2.5 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:p-2.5 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:p-2.5">
        {children}
      </span>
    </label>
  );
}
