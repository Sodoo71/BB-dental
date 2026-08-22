"use client";
import React from "react";
import { Sparkles } from "lucide-react";

export default function Hero({
  scrollToBooking,
}: {
  scrollToBooking: () => void;
}) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950 to-teal-900 px-4 py-16 text-white sm:px-6 sm:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.15),transparent_50%)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold tracking-widest text-cyan-300 backdrop-blur-md sm:px-4 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5" /> Орчин үеийн шүдний эмнэлэг
          </span>
          <h1 className="mt-6 text-3xl font-black leading-tight sm:text-5xl lg:text-7xl">
            Эрүүл инээмсэглэл, <br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
              Төгс чанар.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-sm font-medium leading-relaxed text-slate-300 sm:text-base lg:text-lg">
            Бид хамгийн сүүлийн үеийн дэвшилтэт технологи, мэргэжлийн өндөр
            түвшний эмч нарын баг бүрэлдэхүүнтэйгээр таны шүдний эрүүл мэндийг
            найдвартай хамгаална.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={scrollToBooking}
              className="w-full rounded-2xl bg-cyan-500 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:bg-cyan-400 sm:w-auto sm:px-8"
            >
              Онлайн цаг захиалах
            </button>
            <a
              href="#services"
              className="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-center text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/10 sm:w-auto sm:px-8"
            >
              Үйлчилгээнүүд үзэх
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
