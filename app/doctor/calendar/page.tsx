"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppointmentWorkspace from "@/components/doctor/AppointmentWorkspace";
import { clinicDateKey } from "@/lib/doctor-workspace";
export default function CalendarPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summaryError, setSummaryError] = useState("");
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion(v => v + 1), []);
  const [date, setDate] = useState(clinicDateKey);
  const [month, setMonth] = useState(() => clinicDateKey().slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/doctor/appointments?year=${year}&month=${monthNumber - 1}`, { signal: controller.signal }).then(async res => {
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Сарын тойм ачаалж чадсангүй.");
      const next: Record<string, number> = {};
      for (const row of payload.data as { appointmentDate: string; status: string }[]) {
        if (row.status === "CANCELLED") continue;
        const day = row.appointmentDate.slice(0, 10); next[day] = (next[day] || 0) + 1;
      }
      setCounts(next); setSummaryError("");
    }).catch(error => { if (!controller.signal.aborted) { setCounts({}); setSummaryError(error.message); } });
    return () => controller.abort();
  }, [year, monthNumber, version]);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  function move(delta: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7);
    setMonth(next); setDate(`${next}-01`);
  }
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">Календарь</h1><button className="button-secondary min-h-11 px-3" onClick={() => { const today = clinicDateKey(); setDate(today); setMonth(today.slice(0, 7)); }}>Өнөөдөр</button></div>
      <div className="mb-4 flex items-center justify-between"><button className="button-secondary h-11 w-11" aria-label="Өмнөх сар" onClick={() => move(-1)}><ChevronLeft size={18} /></button><p className="font-semibold" aria-live="polite">{year} оны {monthNumber}-р сар</p><button className="button-secondary h-11 w-11" aria-label="Дараах сар" onClick={() => move(1)}><ChevronRight size={18} /></button></div>
      <div className="grid grid-cols-7 gap-1 text-center">{["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map(day => <span key={day} className="py-2 text-xs text-slate-400">{day}</span>)}{Array.from({length:offset}, (_, i) => <span key={`empty-${i}`} />)}{Array.from({length:count}, (_, i) => { const key = `${month}-${String(i + 1).padStart(2,"0")}`; return <button key={key} aria-label={`${key}${counts[key] ? ` · ${counts[key]} үзлэг` : ""}`} aria-pressed={date === key} onClick={() => setDate(key)} className={`min-h-11 rounded-xl text-sm ${date === key ? "bg-brand-700 font-bold text-white" : key === clinicDateKey() ? "bg-brand-50 font-bold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}><span>{i + 1}</span>{counts[key] && <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-current" />}</button>; })}</div>
      {summaryError && <p role="alert" className="mt-3 text-xs text-red-600">{summaryError}<button className="ml-2 underline" onClick={changed}>Дахин ачаалах</button></p>}
      <p className="mt-4 text-xs text-slate-500">Цэгтэй өдөр үзлэгтэй. Өдрөө сонгож цагуудаа харна. Улаанбаатарын цагаар.</p>
    </section>
    <AppointmentWorkspace selectedDate={date} onChanged={changed} />
  </div>;
}
