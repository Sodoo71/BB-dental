"use client";
import { useClinicInfo } from "@/components/layout/ClinicInfoProvider";
import React, { useState } from "react";
import { Menu, Phone, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/layout/Brand";

export default function Navbar({
  scrollToBooking,
}: {
  scrollToBooking: () => void;
}) {
  const info = useClinicInfo();
  const [open, setOpen] = useState(false);

  const handleNavClick = () => {
    setOpen(false);
    scrollToBooking();
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white ">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="BB Dental нүүр хуудас"><Brand /></Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
          <a href="#services" className="transition hover:text-brand-600">
            Үйлчилгээ
          </a>
          <a href="#doctors" className="transition hover:text-brand-600">
            Эмч нар
          </a>
          <a href="#booking" className="transition hover:text-brand-600">
            Цаг захиалга
          </a>
          <a href="#contact" className="transition hover:text-brand-600">
            Холбоо барих
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden min-h-11 items-center text-xs font-medium text-brand-700 lg:flex">Ажилтны нэвтрэх</Link>
          <a
            href={`tel:${info.phone}`}
            className="hidden items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 xl:flex"
          >
            <Phone className="h-4 w-4 text-brand-600" />
            {info.phone}
          </a>

          <button
            onClick={scrollToBooking}
            className="hidden rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 sm:inline-flex"
          >
            Цаг авах
          </button>

          <button
            type="button"
            aria-label="Үндсэн цэс"
            aria-expanded={open}
            aria-controls="public-navigation"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="public-navigation" className="border-t border-slate-200 bg-white lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm font-bold text-slate-700">
            <a
              href="#services"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              Үйлчилгээ
            </a>
            <a
              href="#doctors"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              Эмч нар
            </a>
            <a
              href="#booking"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              Захиалга
            </a>
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              Холбоо барих
            </a>
            <button
              onClick={handleNavClick}
              className="mt-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white"
            >
              Цаг авах
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
