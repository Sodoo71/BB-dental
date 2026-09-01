"use client";
import React, { useState } from "react";
import { Menu, Phone, Sparkles, X } from "lucide-react";
import Image from "next/image";

export default function Navbar({
  scrollToBooking,
}: {
  scrollToBooking: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handleNavClick = () => {
    setOpen(false);
    scrollToBooking();
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center">
          <Image
            src="/logo.jpg"
            alt="BB Dental Clinic"
            width={120}
            height={40}
            priority
            className="h-10 w-auto object-contain rounded-2xl"
          />
        </div>

        <div className="hidden items-center gap-8 font-bold text-slate-600 md:flex">
          <a href="#services" className="transition hover:text-cyan-600">
            Үйлчилгээ
          </a>
          <a href="#doctors" className="transition hover:text-cyan-600">
            Эмч нар
          </a>
          <a href="#booking" className="transition hover:text-cyan-600">
            Цаг захиалга
          </a>
          <a href="#contact" className="transition hover:text-cyan-600">
            Холбоо барих
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="tel:95963531"
            className="hidden items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 sm:flex"
          >
            <Phone className="h-4 w-4 text-cyan-600" />
            9596-3531
          </a>

          <button
            onClick={scrollToBooking}
            className="hidden rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-cyan-600/25 transition hover:bg-cyan-500 sm:inline-flex"
          >
            Цаг авах
          </button>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm font-bold text-slate-700">
            <a
              href="#services"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              Үйлчилгээ
            </a>
            <a
              href="#about"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 hover:bg-slate-100"
            >
              Бидний тухай
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
              className="mt-2 rounded-xl bg-cyan-600 px-4 py-3 font-black text-white"
            >
              Цаг авах
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
