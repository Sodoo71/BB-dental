"use client";
import { useEffect, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
type Patient = { id: string; name: string; phone: string; totalAppointments: number; lastAppointment: string | null; nextAppointment: string | null };
function dateLabel(value: string | null) { return value ? new Date(value).toLocaleDateString("mn-MN", { timeZone: "UTC" }) : "—"; }
export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/doctor/overview", { signal: controller.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Үйлчлүүлэгчдийн мэдээлэл ачаалж чадсангүй.");
      setPatients(payload.data.patients); setError("");
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const visible = patients.filter(p => `${p.name} ${p.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="space-y-5"><header><h1 className="text-2xl font-semibold">Миний үйлчлүүлэгчид</h1><p className="mt-2 text-sm text-slate-500">Танд цаг авч байсан үйлчлүүлэгчид болон дууссан үзлэгийн тоо.</p></header>
    <label className="relative block"><span className="sr-only">Үйлчлүүлэгч хайх</span><Search size={18} className="absolute left-3 top-3.5 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Нэр эсвэл утасны дугаар" className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm" /></label>
    {loading ? <p role="status" className="flex gap-2 py-8 text-slate-500"><Loader2 className="animate-spin" />Ачаалж байна…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button className="button-secondary mt-3 px-4" onClick={() => { setLoading(true); setReload(v => v + 1); }}>Дахин ачаалах</button></div> : !visible.length ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500"><Users className="mx-auto mb-3" />Үйлчлүүлэгч олдсонгүй.</div> : <div className="grid gap-4 md:grid-cols-2">{visible.map(patient => <article key={patient.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-900">{patient.name}</h2><span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">{patient.totalAppointments} үзлэг</span></div><a href={`tel:${patient.phone}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-4">{patient.phone} · Залгах</a><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs"><div><dt className="text-slate-400">Сүүлийн үзлэг</dt><dd className="mt-1 font-medium text-slate-700">{dateLabel(patient.lastAppointment)}</dd></div><div><dt className="text-slate-400">Дараагийн цаг</dt><dd className="mt-1 font-medium text-slate-700">{dateLabel(patient.nextAppointment)}</dd></div></dl></article>)}</div>}
  </div>;
}
