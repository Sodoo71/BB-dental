"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import Field from "../ui/Field";
import useDoctors from "@/hooks/useDoctors";
import useServices from "@/hooks/useServices";
import useAvailability from "@/hooks/useAvailability";
import useBooking from "@/hooks/useBooking";
import { iso, getCalendarCells, isPastDate } from "@/lib/date";

export type BookingHandle = { select: (selection: { serviceId?: string; doctorId?: string }) => void };
type Suggestion = { date: string; formattedDate: string; slot: string; doctorId: string; doctorName: string; serviceId: string };
const categories: Record<string, string> = { GENERAL: "Ерөнхий үзлэг", PREVENTION: "Урьдчилан сэргийлэлт", TREATMENT: "Эмчилгээ", COSMETIC: "Гоо сайхан", SURGERY: "Мэс ажилбар" };
const money = (price: string | number | null) => price === null ? "Үнэ тодорхойгүй" : `${Number(price).toLocaleString()}₮`;
const pageSize = 6;

export default function BookingSection({ ref }: { ref?: Ref<BookingHandle> }) {
  const today = useMemo(() => new Date(), []);
  const { doctors, loading: doctorsLoading } = useDoctors();
  const { services, loading: servicesLoading } = useServices();
  const { sending, setSending, form, setForm, resetForm } = useBooking();
  const [serviceId, setServiceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const { slots, loading: slotsLoading, error: slotsError } = useAvailability(doctorId, serviceId, date, refresh);
  const [suggestionResponse, setSuggestionResponse] = useState<{ key: string; items: Suggestion[] } | null>(null);
  const suggestionKey = JSON.stringify([serviceId, doctorId, refresh]);
  const suggestions = suggestionResponse?.key === suggestionKey ? suggestionResponse.items : [];
  const service = services.find((item) => item.id === serviceId);
  const doctor = doctors.find((item) => item.id === doctorId);
  const filtered = services.filter((item) => (!category || (item.category || "GENERAL") === category) && item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pageCount = Math.ceil(filtered.length / pageSize);
  const validTime = Boolean(service && doctor && date && form.startTime && !slotsLoading && slots.includes(form.startTime));

  function focusPanel() {
    requestAnimationFrame(() => {
      panel.current?.focus({ preventScroll: true });
      panel.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }
  function changeStep(next: number) { setStep(next); setError(""); focusPanel(); }
  function clearTime() { setForm((previous) => ({ ...previous, startTime: "" })); setError(""); }

  useImperativeHandle(ref, () => ({
    select(selection) {
      if (submitting.current) return;
      if (selection.serviceId !== undefined) setServiceId(selection.serviceId);
      if (selection.doctorId !== undefined) setDoctorId(selection.doctorId);
      clearTime();
      setDate("");
      setSuccess(false);
      setQuery(""); setCategory(""); setPage(0);
      changeStep(selection.serviceId || serviceId ? 2 : 1);
    },
  }));

  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId });
    if (doctorId) params.set("doctorId", doctorId);
    void fetch(`/api/availability/suggest?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setSuggestionResponse({ key: suggestionKey, items: Array.isArray(data.data) ? data.data : [] });
      })
      .catch(() => { if (!controller.signal.aborted) setSuggestionResponse({ key: suggestionKey, items: [] }); });
    return () => controller.abort();
  }, [serviceId, doctorId, suggestionKey]);

  function selectSuggestion(item: Suggestion) {
    setDoctorId(item.doctorId); setDate(item.date);
    const target = new Date(`${item.date}T00:00:00`);
    setMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    setForm((previous) => ({ ...previous, startTime: item.slot }));
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!validTime) { setError("Боломжит цагаа дахин сонгоно уу."); setStep(2); focusPanel(); return; }
    submitting.current = true; setSending(true); setError("");
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), doctorId, serviceId, appointmentDate: date }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { clearTime(); setRefresh((value) => value + 1); setStep(2); }
        throw new Error(data.error || "Захиалгыг бүртгэж чадсангүй.");
      }
      setSuccess(true); resetForm(); setRefresh((value) => value + 1); focusPanel();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Сервертэй холбогдож чадсангүй. Дахин оролдоно уу."); }
    finally { submitting.current = false; setSending(false); }
  }

  return (
    <section id="booking" className="border-y border-brand-100 bg-brand-50/60 py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-3 sm:px-6">
        <div className="mb-6 text-center">
          <p className="eyebrow">ОНЛАЙН ЦАГ ЗАХИАЛГА</p>
          <h2 className="mt-2 text-2xl font-semibold text-brand-900 sm:text-4xl">Үзлэгийн цагаа захиалаарай</h2>
          <p className="mt-3 text-sm text-slate-600">Үйлчилгээгээ сонгоод, өөрт тохирох цагаа баталгаажуулаарай.</p>
        </div>
        <div ref={panel} tabIndex={-1} aria-label="Цаг захиалгын алхмууд" className="scroll-mt-28 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm focus:outline-none">
          {success ? <div className="p-8 text-center" role="status"><CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-brand-600" /><h3 className="text-xl font-semibold">Цаг амжилттай захиалагдлаа</h3><p className="mt-3 text-slate-600">Таны захиалгыг бүртгэж авлаа.</p><button type="button" className="button-primary mt-6" onClick={() => { setSuccess(false); setDate(""); changeStep(1); }}>Дахин цаг захиалах</button></div> : <>
            <ol className="grid grid-cols-3 border-b border-brand-100 bg-brand-50/50 p-3 sm:p-5">
              {["Үйлчилгээ", "Өдөр, цаг", "Баталгаажуулах"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className="flex flex-col items-center gap-2 text-center text-[10px] sm:text-xs"><span className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${step >= index + 1 ? "bg-brand-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>{step > index + 1 ? <Check size={16} /> : index + 1}</span><span className={step === index + 1 ? "font-semibold text-brand-800" : "text-slate-500"}>{label}</span></li>)}
            </ol>
            {(service || doctor) && <div className="flex items-start justify-between gap-3 border-b border-brand-100 px-4 py-3 text-xs sm:px-6"><div className="min-w-0"><p className="font-semibold text-brand-900">{service?.name || "Үйлчилгээгээ сонгоно уу"}</p><p className="mt-1 text-slate-600">{doctor?.name && `${doctor.name} · `}{service && `${service.durationMin} мин · ${money(service.price)}`}</p>{date && <p className="mt-1 text-brand-700">{date} {form.startTime && `· ${form.startTime}`}</p>}</div>{step > 1 && <button type="button" disabled={sending} onClick={() => changeStep(1)} className="min-h-11 shrink-0 text-brand-700 underline underline-offset-4">Солих</button>}</div>}
            <div className="p-4 sm:p-6">
              {step === 1 && <div className="space-y-4">
                <h3 className="text-lg font-semibold">Үйлчилгээ сонгох</h3>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={18} className="shrink-0 text-brand-600" /><input aria-label="Захиалах үйлчилгээ хайх" type="search" placeholder="Үйлчилгээний нэрээр хайх…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="w-full bg-transparent py-3 outline-none" /></label>
                <label className="flex items-center gap-3 text-xs text-slate-600">Ангилал<select aria-label="Захиалгын үйлчилгээний ангилал" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3" value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}><option value="">Бүх үйлчилгээ</option>{Array.from(new Set(services.map((item) => item.category || "GENERAL"))).map((item) => <option key={item} value={item}>{categories[item] || item}</option>)}</select></label>
                {servicesLoading ? <p role="status" className="py-8 text-center text-slate-500">Үйлчилгээг ачаалж байна…</p> : !services.length ? <p role="status">Үйлчилгээний мэдээлэл олдсонгүй. Хуудсаа дахин ачаална уу.</p> : !filtered.length ? <p role="status" className="py-6 text-center text-slate-500">Хайлтад тохирох үйлчилгээ олдсонгүй.</p> : <>
                  <div className="grid gap-2 sm:grid-cols-2">{filtered.slice(page * pageSize, (page + 1) * pageSize).map((item) => <button key={item.id} type="button" aria-pressed={serviceId === item.id} onClick={() => { if (serviceId !== item.id) { setServiceId(item.id); clearTime(); } changeStep(2); }} className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border p-3 text-left ${serviceId === item.id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-400 hover:bg-brand-50/50"}`}><span><span className="block text-sm font-medium">{item.name}</span><span className="mt-1 block text-xs text-slate-500">{item.durationMin} мин · {money(item.price)}</span></span><ArrowRight size={16} className="shrink-0 text-brand-600" /></button>)}</div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{filtered.length} үйлчилгээ · {page + 1}/{pageCount}</span><div className="flex gap-2"><button type="button" aria-label="Өмнөх үйлчилгээнүүд" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="button-secondary disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label="Дараах үйлчилгээнүүд" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} className="button-secondary disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
                </>}
              </div>}
              {step === 2 && <div className="space-y-5">
                <Field label="Эмч сонгох"><select disabled={doctorsLoading} value={doctorId} onChange={(event) => { setDoctorId(event.target.value); clearTime(); }}><option value="">{doctorsLoading ? "Эмч нарыг ачаалж байна…" : "Эмчээ сонгоно уу"}</option>{doctors.map((item) => <option key={item.id} value={item.id}>{item.name}{item.title ? ` · ${item.title}` : ""}</option>)}</select></Field>
                {!doctorsLoading && !doctors.length && <p role="status" className="text-sm text-red-600">Эмчийн мэдээлэл олдсонгүй. Хуудсаа дахин ачаална уу.</p>}
                {suggestions.length > 0 && <div className="rounded-xl bg-brand-50 p-3"><p className="mb-2 text-xs font-semibold text-brand-800">Ойрын боломжит цаг — нэг дараад сонгох</p><div className="grid grid-cols-2 gap-2">{suggestions.slice(0, 2).map((item) => <button key={`${item.doctorId}-${item.date}-${item.slot}`} type="button" onClick={() => selectSuggestion(item)} className="min-h-14 rounded-lg border border-brand-200 bg-white p-2 text-left text-xs text-brand-800 hover:border-brand-600"><span className="block font-semibold">{item.formattedDate} · {item.slot}</span><span className="mt-1 block">{item.doctorName}</span></button>)}</div></div>}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-2 sm:p-3">
                    <div className="mb-2 flex items-center justify-between"><button type="button" aria-label="Өмнөх сар" disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-brand-50 disabled:opacity-30"><ChevronLeft size={18} /></button><span className="text-sm font-semibold">{month.getFullYear()} · {month.getMonth() + 1}-р сар</span><button type="button" aria-label="Дараах сар" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-brand-50"><ChevronRight size={18} /></button></div>
                    <div className="grid grid-cols-7 gap-y-1 text-center text-xs">{["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"].map((day) => <span key={day} className="py-2 text-slate-400">{day}</span>)}{getCalendarCells(month).map((day, index) => day ? <button key={iso(day)} type="button" aria-label={iso(day)} aria-pressed={date === iso(day)} disabled={isPastDate(day, today)} onClick={() => { setDate(iso(day)); clearTime(); }} className={`h-10 w-full rounded-lg font-medium disabled:text-slate-300 ${date === iso(day) ? "bg-brand-600 text-white" : "hover:bg-brand-50"}`}>{day.getDate()}</button> : <span key={`empty-${index}`} />)}</div>
                  </div>
                  <div><h3 className="mb-3 text-sm font-semibold">Боломжит цагууд</h3>{!doctorId || !date ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Эмч, өдрөө сонгоход сул цагууд энд харагдана.</p> : slotsLoading ? <p role="status" className="flex items-center gap-2 text-sm text-brand-700"><Loader2 size={18} className="animate-spin" />Цагуудыг шалгаж байна…</p> : slotsError ? <div role="alert"><p className="text-sm text-red-600">{slotsError}</p><button type="button" className="button-secondary mt-3" onClick={() => setRefresh((value) => value + 1)}>Дахин оролдох</button></div> : !slots.length ? <p role="status" className="rounded-xl bg-brand-50 p-4 text-sm text-slate-600">Энэ өдөр сул цаг алга. Өөр өдөр эсвэл эмч сонгоно уу.</p> : <div aria-label="Боломжит цагууд" className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto p-1">{slots.map((slot) => <button key={slot} type="button" aria-pressed={form.startTime === slot} onClick={() => setForm((previous) => ({ ...previous, startTime: slot }))} className={`min-h-11 rounded-lg border text-sm font-semibold ${form.startTime === slot ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 hover:bg-brand-50"}`}>{slot}</button>)}</div>}{form.startTime && !slotsLoading && !slotsError && !validTime && <p role="status" className="mt-3 text-sm text-red-600">Энэ цаг боломжгүй болсон байна. Өөр цаг сонгоно уу.</p>}</div>
                </div>
              </div>}
              {step === 3 && <form id="booking-patient-form" onSubmit={submit}>
                <h3 className="mb-4 text-lg font-semibold">Таны мэдээлэл</h3>
                <fieldset disabled={sending} className="min-w-0"><div className="grid gap-x-4 sm:grid-cols-2"><Field label="Овог нэр *"><input required autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Овог нэрээ оруулна уу" /></Field><Field label="Утасны дугаар *"><input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Утасны дугаар" /></Field></div><details className="mt-1 rounded-xl border border-slate-200 p-3"><summary className="text-sm text-slate-600">Нэмэлт мэдээлэл (заавал биш)</summary><div className="mt-4 grid gap-x-4 sm:grid-cols-2"><Field label="Нас"><input type="number" min="0" max="150" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></Field><Field label="Хүйс"><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="MALE">Эрэгтэй</option><option value="FEMALE">Эмэгтэй</option><option value="OTHER">Бусад</option></select></Field></div><Field label="Зовиур / Нэмэлт тайлбар"><textarea rows={3} value={form.chiefComplaint} onChange={(event) => setForm({ ...form, chiefComplaint: event.target.value })} /></Field></details></fieldset>
              </form>}
              {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            </div>
            {step > 1 && <div className="flex items-center gap-3 border-t border-slate-100 bg-white p-4 sm:px-6"><button type="button" disabled={sending} className="button-secondary" onClick={() => changeStep(step - 1)}><ChevronLeft size={16} />Буцах</button>{step === 2 ? <button type="button" disabled={!validTime} onClick={() => changeStep(3)} className="button-primary flex-1 disabled:opacity-40">Үргэлжлүүлэх<ArrowRight size={16} /></button> : <button type="submit" form="booking-patient-form" disabled={sending || !validTime} className="button-primary flex-1 disabled:opacity-40">{sending && <Loader2 size={16} className="animate-spin" />}{sending ? "Илгээж байна…" : "Захиалга баталгаажуулах"}</button>}</div>}
          </>}
        </div>
      </div>
    </section>
  );
}
