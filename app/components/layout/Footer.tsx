"use client";
import React from "react";
import { Sparkles, Clock, Phone, MapPin } from "lucide-react";

export default function Footer({
  scrollToBooking,
}: {
  scrollToBooking: () => void;
}) {
  return (
    <footer
      id="contact"
      className="border-t border-slate-800 bg-slate-950 text-slate-400"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-6 w-6 text-cyan-400" />
              <span className="text-xl font-black">BB DENTAL</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              Танд болон таны гэр бүлд чанартай, сэтгэл ханамжтай шүдний тусламж
              үйлчилгээг үзүүлэхэд бид бэлэн байна.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white">Цагийн хуваарь</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" /> Даваа - Баасан:
                09:00 - 20:00
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" /> Бямба - Ням: 10:00 -
                18:00
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white">Холбоо барих</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-cyan-400" /> +976 7700-1122
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-400" /> Улаанбаатар хот,
                Сүхбаатар дүүрэг, 1-р хороо
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white">Онлайн захиалга</h4>
            <p className="mt-4 text-sm">
              Та гэрээсээ шууд цаг захиалан дараалалгүй үйлчлүүлээрэй.
            </p>
            <button
              onClick={scrollToBooking}
              className="mt-4 w-full rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white hover:bg-cyan-500"
            >
              Одоо цаг авах
            </button>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-900 pt-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} BB Dental Clinic. Бүх права хуулиар
          хамгаалагдсан.
        </div>
      </div>
    </footer>
  );
}
