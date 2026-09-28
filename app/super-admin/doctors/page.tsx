"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert, Loader2, Pencil, Plus, Search, Stethoscope, X } from "lucide-react";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ClinicImage } from "@/components/ui/ClinicImage";
import { PageHeader } from "@/components/super-admin/page-header";
import { showToast } from "@/components/ui/Toast";
import { doctorProfileSchema } from "@/lib/validation/doctor";

type Doctor = {
  id: string; name: string; specialty: string; title: string | null;
  phone: string | null; email: string | null; avatarUrl: string | null;
  imageUrl: string | null; telegramChatId: string | null; experience: number;
  description: string | null; isActive: boolean;
};
const emptyForm = { name: "", specialty: "", title: "", phone: "", email: "", telegramChatId: "", avatarUrl: "", experience: "0", description: "", isActive: true };
const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";
const labelClass = "grid content-start gap-2 text-sm font-medium text-slate-700";

export default function SuperAdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const initialForm = useRef(emptyForm);
  const saving = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/doctors", { signal: controller.signal }).then(async res => {
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Эмчийн мэдээлэл ачаалж чадсангүй.");
      setDoctors(payload.data);
      setLoadError("");
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Мэдээлэл ачаалж чадсангүй.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function openForm(doctor?: Doctor) {
    const values = doctor ? {
      name: doctor.name, specialty: doctor.specialty, title: doctor.title || "",
      phone: doctor.phone || "", email: doctor.email || "", avatarUrl: doctor.avatarUrl || doctor.imageUrl || "",
      telegramChatId: doctor.telegramChatId || "", experience: String(doctor.experience),
      description: doctor.description || "", isActive: doctor.isActive,
    } : { ...emptyForm };
    setEditing(doctor || null);
    setForm(values);
    initialForm.current = values;
    setFormError("");
    setDiscarding(false);
    setModalOpen(true);
  }
  function closeForm() {
    if (saving.current || uploading) return;
    if (JSON.stringify(form) !== JSON.stringify(initialForm.current)) { setDiscarding(true); return; }
    setModalOpen(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || uploading) return;
    const parsed = doctorProfileSchema.safeParse({ ...form, experience: Number(form.experience) });
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    saving.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(editing ? `/api/admin/doctors/${editing.id}` : "/api/admin/doctors", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Хадгалж чадсангүй. Дахин оролдоно уу.");
      setDoctors(current => [...current.filter(d => d.id !== payload.data.id), payload.data].sort((a, b) => a.name.localeCompare(b.name, "mn")));
      setModalOpen(false);
      showToast(editing ? "Эмчийн мэдээллийг шинэчиллээ." : "Шинэ эмчийг бүртгэлээ.", "success");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Хадгалах үед алдаа гарлаа."); }
    finally { saving.current = false; setSubmitting(false); }
  }
  const query = search.trim().toLocaleLowerCase();
  const filtered = doctors.filter(d => (status === "ALL" || d.isActive === (status === "ACTIVE")) && [d.name, d.specialty, d.title, d.email, d.phone].some(value => value?.toLocaleLowerCase().includes(query)));
  const activeCount = doctors.filter(d => d.isActive).length;

  return <div className="space-y-6">
    <PageHeader title="Эмчийн бүртгэл" description="Эмчийн мэдээлэл, мэргэшил болон холбоо барих мэдээллийг нэг дор удирдана." action={<button type="button" onClick={() => openForm()} className="button-primary min-h-11 px-4 py-3"><Plus size={17} />Эмч нэмэх</button>} />
    <div className="grid grid-cols-3 gap-3">
      {[{ label: "Нийт эмч", count: doctors.length }, { label: "Идэвхтэй", count: activeCount }, { label: "Идэвхгүй", count: doctors.length - activeCount }].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-700">{loading || loadError ? "—" : item.count}</p></div>)}
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <label className="relative block sm:max-w-md sm:flex-1"><span className="sr-only">Эмч хайх</span><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input className={`${inputClass} pl-10`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Нэр, мэргэшил, утсаар хайх…" /></label>
        <label className="flex items-center gap-3 text-sm text-slate-500"><span>Төлөв</span><select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Бүх эмч</option><option value="ACTIVE">Идэвхтэй</option><option value="INACTIVE">Идэвхгүй</option></select></label>
      </div>
      {loadError ? <div role="alert" className="p-8 text-center"><CircleAlert className="mx-auto mb-3 text-amber-600" /><p className="text-sm text-slate-700">{loadError}</p><button onClick={() => { setLoading(true); setLoadError(""); setReload(v => v + 1); }} className="button-secondary mt-4 min-h-11 px-4">Дахин ачаалах</button></div>
        : loading ? <div role="status" className="flex items-center justify-center gap-3 p-16 text-sm text-slate-500"><Loader2 className="animate-spin" size={20} />Эмчийн мэдээлэл ачаалж байна…</div>
        : filtered.length === 0 ? <div className="px-6 py-14 text-center"><Stethoscope className="mx-auto mb-4 text-brand-400" size={32} /><h2 className="font-semibold text-slate-800">{doctors.length ? "Хайлттай тохирох эмч олдсонгүй" : "Анхны эмчээ бүртгээрэй"}</h2><p className="mt-2 text-sm text-slate-500">{doctors.length ? "Нэр эсвэл төлөвийн шүүлтээ өөрчилж үзнэ үү." : "Эмчийн нэр, мэргэшлийг оруулаад бусад мэдээллийг дараа нь нэмж болно."}</p><button className="button-secondary mt-5 min-h-11 px-4" onClick={() => doctors.length ? (setSearch(""), setStatus("ALL")) : openForm()}>{doctors.length ? "Шүүлт цэвэрлэх" : "Эмч нэмэх"}</button></div>
        : <div className="divide-y divide-slate-100">{filtered.map(doctor => <article key={doctor.id} className="flex flex-col gap-4 p-4 transition hover:bg-slate-50/60 sm:p-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-lg font-semibold text-brand-700">{doctor.avatarUrl || doctor.imageUrl ? <ClinicImage src={doctor.avatarUrl || doctor.imageUrl || ""} alt={doctor.name} className="h-full w-full object-cover" /> : doctor.name.slice(0, 2)}</div><div className="min-w-0"><Link href={`/super-admin/doctors/${doctor.id}`} className="break-words font-semibold text-slate-900 hover:text-brand-600 hover:underline">{doctor.name}</Link><p className="mt-1 break-words text-sm text-slate-500">{doctor.specialty || "Мэргэшил оруулаагүй"}{doctor.title ? ` · ${doctor.title}` : ""}</p></div></div>
          <div className="grid min-w-0 gap-1 pl-[68px] text-sm lg:w-52 lg:pl-0">{doctor.phone ? <a href={`tel:${doctor.phone}`} className="text-slate-700 hover:text-brand-600">{doctor.phone}</a> : <span className="text-slate-400">Утас оруулаагүй</span>}{doctor.email && <a href={`mailto:${doctor.email}`} className="break-all text-xs text-slate-500 hover:text-brand-600">{doctor.email}</a>}</div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:border-0 lg:pt-0"><span className={`rounded-full px-3 py-1 text-xs font-medium ${doctor.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{doctor.isActive ? "Идэвхтэй" : "Идэвхгүй"}</span><div className="flex items-center gap-2"><button type="button" aria-label={`${doctor.name} мэдээлэл засах`} onClick={() => openForm(doctor)} className="button-secondary min-h-11 px-3"><Pencil size={15} />Засах</button><Link aria-label={`${doctor.name} дэлгэрэнгүй`} href={`/super-admin/doctors/${doctor.id}`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-brand-50"><ArrowUpRight size={18} /></Link></div></div>
        </article>)}<p className="px-5 py-3 text-xs text-slate-400" aria-live="polite">{doctors.length} эмчээс {filtered.length} харагдаж байна</p></div>}
    </section>

    {modalOpen && <DialogFrame onClose={closeForm} label={editing ? "Эмчийн мэдээлэл засах" : "Шинэ эмч бүртгэх"} size="max-w-3xl">
      <form onSubmit={submit}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-5 sm:px-7"><div><p className="mb-1 text-xs font-medium text-brand-600">ЭМЧИЙН БҮРТГЭЛ</p><h2 className="text-xl font-semibold text-slate-900">{editing ? "Эмчийн мэдээлэл засах" : "Шинэ эмч нэмэх"}</h2><p className="mt-2 text-sm text-slate-500">* тэмдэгтэй талбарыг заавал бөглөнө.</p></div><button type="button" aria-label="Хаах" disabled={submitting || uploading} onClick={closeForm} className="text-slate-400 hover:bg-slate-50"><X size={20} /></button></div>
        <fieldset disabled={submitting} className="space-y-7 px-5 py-6 disabled:opacity-70 sm:px-7">
          <div className="grid gap-6 sm:grid-cols-[160px_1fr]"><div><ImageUpload onUploadingChange={setUploading} label="Эмчийн зураг" value={form.avatarUrl} onChange={avatarUrl => setForm(p => ({ ...p, avatarUrl }))} /><p className="mt-2 text-xs leading-5 text-slate-400">Нүүр хуудсан дээр харагдах зураг.</p></div><div className="grid content-start gap-4"><label className={labelClass}>Эмчийн бүтэн нэр *<input autoFocus required minLength={2} maxLength={120} autoComplete="name" className={inputClass} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Жишээ: Б. Тэмүүлэн" /></label><label className={labelClass}>Мэргэшил *<input required maxLength={120} list="doctor-specialties" className={inputClass} value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))} placeholder="Сонгох эсвэл бичих" /><datalist id="doctor-specialties">{["Нүүр амны эмчилгээ", "Нүүр амны согог засал", "Гажиг засал", "Хүүхдийн шүд", "Нүүр амны мэс засал"].map(s => <option key={s} value={s} />)}</datalist></label></div></div>
          <section className="space-y-4 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-900">Мэргэжлийн мэдээлэл</h3><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Албан тушаал / Цол<input maxLength={120} className={inputClass} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Жишээ: Их эмч" /></label><label className={labelClass}>Ажилласан жил<input required type="number" min={0} max={80} step={1} className={inputClass} value={form.experience} onChange={e => setForm(p => ({ ...p, experience: e.target.value }))} /></label></div><label className={labelClass}>Товч танилцуулга<textarea rows={3} maxLength={2000} className={`${inputClass} resize-y`} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Мэргэшил, ажлын туршлагын тухай товч бичнэ үү." /></label></section>
          <section className="space-y-4 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-900">Холбоо барих</h3><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Утасны дугаар<input type="tel" autoComplete="tel" maxLength={40} className={inputClass} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="9911 2233" /></label><label className={labelClass}>И-мэйл хаяг<input type="email" autoComplete="email" className={inputClass} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="doctor@example.mn" /></label></div><label className={labelClass}>Telegram Chat ID<input inputMode="numeric" aria-describedby="telegram-help" className={inputClass} value={form.telegramChatId} onChange={e => setForm(p => ({ ...p, telegramChatId: e.target.value }))} placeholder="Жишээ: 123456789" /></label><p id="telegram-help" className="text-xs leading-5 text-slate-500">Цаг захиалгын мэдэгдэл авах бол bot дээр /start дарж, тоон Chat ID-гаа оруулна. Дараа нь нэмж болно.</p></section>
          {editing ? <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="mt-1 h-4 w-4 accent-brand-600" /><span className="text-sm font-medium text-slate-700">Идэвхтэй эмч<span className="mt-1 block text-xs font-normal leading-5 text-slate-500">Идэвхгүй болговол шинэ цаг авах жагсаалтаас хасагдаж, холбоотой нэвтрэх эрх түдгэлзэнэ.</span></span></label> : <p className="rounded-xl bg-brand-50 p-4 text-xs leading-6 text-brand-700">Энэ маягтаар эмчийн профайл үүсгэнэ. Нэвтрэх эрхийг “Ажилтнууд” хэсгээс, цаг авах боломжийг эмчийн ажлын хуваариар тохируулна.</p>}
        </fieldset>
        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
          {formError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          {discarding ? <div role="alert" className="space-y-3"><p className="text-sm text-slate-700">Хадгалаагүй өөрчлөлт байна. Хаах уу?</p><div className="flex flex-wrap gap-2"><button type="button" className="button-secondary min-h-11 px-4" onClick={() => setDiscarding(false)}>Үргэлжлүүлэн засах</button><button type="button" className="min-h-11 rounded-xl px-4 text-sm font-medium text-red-600" onClick={() => setModalOpen(false)}>Хадгалахгүй хаах</button></div></div> : <div className="flex items-center justify-end gap-3"><button type="button" disabled={submitting || uploading} onClick={closeForm} className="button-secondary min-h-11 px-4">Болих</button><button type="submit" disabled={submitting || uploading} className="button-primary min-h-11 px-5 disabled:opacity-50">{submitting ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}{uploading ? "Зураг хуулж байна…" : submitting ? "Хадгалж байна…" : editing ? "Өөрчлөлт хадгалах" : "Эмч бүртгэх"}</button></div>}
        </div>
      </form>
    </DialogFrame>}
  </div>;
}
