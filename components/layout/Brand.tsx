"use client";
import { useClinicInfo } from "./ClinicInfoProvider";
import Image from "next/image";
export function Brand({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const info = useClinicInfo();
  return <div className="flex shrink-0 items-center gap-3">
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500"><Image src={info.logoUrl || "/images/bb-dental-logo.jpg"} alt={info.clinicName} width={56} height={56} unoptimized className="h-full w-full object-contain" /></span>
    {!compact && <span><span className={`block font-serif text-lg tracking-wide ${dark ? "text-white" : "text-brand-700"}`}>{info.clinicName}</span><span className={`block text-[9px] font-medium tracking-[.24em] ${dark ? "text-brand-200" : "text-slate-500"}`}>CLINIC & CARE</span></span>}
  </div>;
}
