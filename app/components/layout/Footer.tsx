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
          {/* Brand */}
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

          {/* Opening hours */}
          <div>
            <h4 className="font-bold text-white">Цагийн хуваарь</h4>

            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-cyan-400" />
                <span>Даваа - Баасан | 09:00-19:00</span>
              </li>

              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-cyan-400" />
                <span>Бямба - Ням | 10:00-18:00</span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white">Холбоо барих</h4>

            <ul className="mt-4 space-y-4 text-sm">
              <li>
                <a
                  href="tel:+97695963531"
                  className="flex items-center gap-2 transition-colors hover:text-white"
                >
                  <Phone className="h-4 w-4 shrink-0 text-cyan-400" />
                  <span>+976 9596-3531</span>
                </a>
              </li>

              <li>
                <a
                  href="https://maps.app.goo.gl/McqVo5a7imhDMger9?g_st=ipcq1q"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 transition-colors hover:text-white"
                >
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />

                  <span>
                    БГД, 12-р хороо, 3, 4-р хороолол,
                
                    Бичлийн аркны автобусны буудал дээр,
                    
                    Азифармтай эмийн сангийн 3 давхарт,
                    
                    BB Dental Clinic
                  </span>
                </a>
              </li>
            </ul>
          </div>

          {/* Booking */}
          <div>
            <h4 className="font-bold text-white">Онлайн цаг захиалга</h4>

            <button
              onClick={scrollToBooking}
              className="mt-4 w-full rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-500"
            >
              Одоо цаг авах
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-slate-900 pt-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} BB Dental Clinic. Бүх эрх хуулиар
          хамгаалагдсан.
        </div>
      </div>
    </footer>
  );
}
