"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { appointmentLabels } from "@/lib/doctor-workspace";
import { showToast } from "@/components/ui/Toast";

type Patient = { id: string; fullName: string; phone: string; email: string | null; age: number | null; gender: "MALE" | "FEMALE" | "OTHER" | null; createdAt: string };
type Visit = { id: string; doctorId: string | null; serviceId: string; appointmentDate: string; startTime: string; status: keyof typeof appointmentLabels; doctor: { name: string } | null; service: { name: string }; chiefComplaint?: string | null; note?: string | null; notes?: { id: string; note: string; author: string | null }[] };
type Detail = Patient & { appointments: Visit[] };
const dateLabel = (value: string) => new Date(value).toLocaleDateString("mn-MN", { timeZone: "UTC" });

function PatientEditor({ patient, onClose, onSaved }: { patient: Patient | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(patient?.fullName ?? "");
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [email, setEmail] = useState(patient?.email ?? "");
  const [age, setAge] = useState(patient?.age?.toString() ?? "");
  const [gender, setGender] = useState(patient?.gender ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(patient ? `/api/patients/${encodeURIComponent(patient.id)}` : "/api/patients", {
        method: patient ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, phone, email, age: age ? Number(age) : null, gender: gender || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Хадгалж чадсангүй.");
      showToast("Үйлчлүүлэгчийн мэдээлэл хадгалагдлаа.", "success"); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Хадгалж чадсангүй."); }
    finally { setSaving(false); }
  }
  return <DialogFrame label={patient ? "Үйлчлүүлэгч засах" : "Үйлчлүүлэгч бүртгэх"} onClose={() => { if (!saving) onClose(); }} size="max-w-lg"><form onSubmit={save} className="space-y-4 p-6"><h2 className="text-xl font-semibold">{patient ? "Мэдээлэл засах" : "Үйлчлүүлэгч бүртгэх"}</h2><fieldset disabled={saving} className="grid gap-4"><label>Овог нэр<input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label><label>Утас<input required type="tel" maxLength={32} value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label><label>И-мэйл<input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label><div className="grid grid-cols-2 gap-4"><label>Нас<input type="number" min={0} max={150} value={age} onChange={e => setAge(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label><label>Хүйс<select value={gender} onChange={e => setGender(e.target.value as typeof gender)} className="mt-1 block w-full rounded-lg border p-3"><option value="">Бүртгээгүй</option><option value="MALE">Эрэгтэй</option><option value="FEMALE">Эмэгтэй</option><option value="OTHER">Бусад</option></select></label></div></fieldset>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="button-secondary">Буцах</button><button disabled={saving} className="button-primary">{saving ? "Хадгалж байна…" : "Хадгалах"}</button></div></form></DialogFrame>;
}

export function PatientDirectory() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [editor, setEditor] = useState<{ patient: Patient | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/patients?${new URLSearchParams({ page: String(page), search })}`, { signal: controller.signal }).then(async response => {
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Мэдээлэл ачаалж чадсангүй.");
        setPatients(payload.data); setTotal(payload.pagination.total); setError("");
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, version]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/patients/${encodeURIComponent(selectedId)}?page=${historyPage}`, { signal: controller.signal }).then(async response => {
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Түүх ачаалж чадсангүй.");
      setDetail(payload.data); setHistoryTotal(payload.pagination.total); setDetailError("");
    }).catch(error => { if (!controller.signal.aborted) setDetailError(error.message); });
    return () => controller.abort();
  }, [selectedId, historyPage, version]);
  return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Үйлчлүүлэгчид</h1><p className="mt-2 text-sm text-slate-500">Бүртгэл, холбоо барих мэдээлэл болон үзлэгийн түүх.</p></div><button className="button-primary" onClick={() => setEditor({ patient: null })}>Шинээр бүртгэх</button></header><Link href="/admin" className="inline-block text-sm text-brand-700 underline">Цаг захиалга руу очих</Link><label className="block"><span className="sr-only">Үйлчлүүлэгч хайх</span><input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Нэр эсвэл утас" className="min-h-12 w-full rounded-xl border border-slate-200 p-3" /></label>{error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}<button className="ml-3 underline" onClick={() => setVersion(v => v + 1)}>Дахин ачаалах</button></p> : loading ? <p role="status">Ачаалж байна…</p> : <><div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Нэр</th><th className="p-3">Утас</th><th className="p-3">Бүртгэсэн өдөр</th><th className="p-3"><span className="sr-only">Үйлдэл</span></th></tr></thead><tbody>{patients.map(patient => <tr key={patient.id} className="border-t"><td className="p-3"><button className="min-h-11 font-medium text-brand-700 underline" onClick={() => { setDetail(null); setDetailError(""); setHistoryPage(1); setSelectedId(patient.id); }}>{patient.fullName}</button></td><td className="p-3">{patient.phone}</td><td className="p-3">{dateLabel(patient.createdAt)}</td><td className="p-3"><button className="button-secondary" onClick={() => setEditor({ patient })}>Засах</button></td></tr>)}</tbody></table>{!patients.length && <p className="p-8 text-center text-slate-500">Үйлчлүүлэгч олдсонгүй.</p>}</div><div className="flex items-center justify-between text-sm"><span>{total} бүртгэл · {page}-р хуудас</span><div className="flex gap-2"><button className="button-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Өмнөх</button><button className="button-secondary" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Дараах</button></div></div></>}{selectedId && <section className="dashboard-card space-y-4" aria-label="Үйлчлүүлэгчийн түүх"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{detail?.fullName ?? "Үзлэгийн түүх"}</h2><button className="button-secondary" onClick={() => setSelectedId("")}>Хаах</button></div>{detailError ? <p role="alert" className="text-red-700">{detailError}</p> : !detail ? <p role="status">Түүх ачаалж байна…</p> : <><p className="text-sm text-slate-500">{detail.phone} · {detail.email || "И-мэйл бүртгээгүй"} · Бүртгэсэн: {dateLabel(detail.createdAt)}</p>{detail.appointments.map(visit => <article key={visit.id} className="space-y-2 rounded-xl border p-4"><p className="font-medium">{dateLabel(visit.appointmentDate)} · {visit.startTime} · {appointmentLabels[visit.status]}</p><p className="text-sm">{visit.service.name} · {visit.doctor?.name || "Эмч хуваарилаагүй"}</p>{visit.chiefComplaint && <p className="whitespace-pre-wrap text-sm">Зовиур: {visit.chiefComplaint}</p>}{visit.note && <p className="whitespace-pre-wrap text-sm">{visit.note}</p>}<Link href={`/admin?${new URLSearchParams({ patientId: detail.id, serviceId: visit.serviceId, ...(visit.doctorId ? { doctorId: visit.doctorId } : {}) })}`} className="inline-flex min-h-11 items-center text-sm text-brand-700 underline">Давтан цаг авах</Link>{visit.notes?.map(note => <p key={note.id} className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{note.note}{note.author && <span className="block text-xs text-slate-500">{note.author}</span>}</p>)}</article>)}{!detail.appointments.length && <p className="text-sm text-slate-500">Үзлэгийн түүх алга.</p>}<div className="flex items-center justify-between gap-3 text-sm"><span>{historyTotal} үзлэг</span><div className="flex gap-2"><button className="button-secondary" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>Өмнөх түүх</button><button className="button-secondary" disabled={historyPage * 50 >= historyTotal} onClick={() => setHistoryPage(p => p + 1)}>Дараах түүх</button></div></div></>}</section>}{editor && <PatientEditor key={editor.patient?.id ?? "new"} patient={editor.patient} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setVersion(v => v + 1); }} />}</div>;
}
