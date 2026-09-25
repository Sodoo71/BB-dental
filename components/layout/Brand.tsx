import { Stethoscope } from "lucide-react";
export function Brand({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return <div className="flex shrink-0 items-center gap-3">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${dark ? "border-white/20 text-gold" : "border-brand-200 bg-brand-50 text-brand-700"}`}><Stethoscope className="h-5 w-5" aria-hidden="true" /></span>
    {!compact && <span><span className={`block font-serif text-lg tracking-wide ${dark ? "text-white" : "text-brand-700"}`}>BB DENTAL</span><span className={`block text-[9px] font-medium tracking-[.24em] ${dark ? "text-brand-200" : "text-slate-500"}`}>CLINIC & CARE</span></span>}
  </div>;
}
