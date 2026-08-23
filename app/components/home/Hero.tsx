"use client";
import React from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";

export default function Hero({
  scrollToBooking,
}: {
  scrollToBooking: () => void;
}) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-[#01788c] via-[#028da3] to-[#01b5cb] pt-12 pb-28 text-white sm:pt-16 sm:pb-36 lg:pb-40">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Зүүн талын текст хэсэг */}
          <div className="z-10 lg:col-span-7">
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
              Эрүүл инээмсэглэл, <br />
              <span className="text-cyan-200">Төгс чанар.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base font-normal leading-relaxed text-cyan-50/90 sm:text-lg">
              Бид хамгийн сүүлийн үеийн дэвшилтэт технологи, мэргэжлийн өндөр
              түвшний эмч нарын баг бүрэлдэхүүнтэйгээр таны шүдний эрүүл мэндийг
              найдвартай хамгаална.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={scrollToBooking}
                className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#01788c] shadow-lg transition-all hover:bg-cyan-50 hover:shadow-xl active:scale-95"
              >
                Онлайн цаг захиалах
              </button>
              <a
                href="#services"
                className="rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-center text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
              >
                Үйлчилгээнүүд үзэх
              </a>
            </div>
          </div>

          {/* Баруун талын зураг (Tooth Character) */}
          <div className="relative z-10 flex justify-center lg:col-span-5 lg:justify-end">
            <div className="relative h-72 w-72 sm:h-96 sm:w-96 lg:h-[420px] lg:w-[420px]">
              <Image
                src="/img-1.png"
                alt="Tooth Character"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Доод талын цагаан долгион (Wave SVG) */}
      <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none">
        <svg
          className="relative block w-full h-16 sm:h-24 lg:h-32 text-white"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,0 C150,90 350,-40 500,65 C650,170 900,10 1200,40 L1200,120 L0,120 Z"></path>
        </svg>
      </div>
    </header>
  );
}
