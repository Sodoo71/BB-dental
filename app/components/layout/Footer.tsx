"use client";

import { useClinicInfo } from "@/components/layout/ClinicInfoProvider";
import { Brand } from "@/components/layout/Brand";
import React from "react";
import Link from "next/link";
import { Phone, MapPin } from "lucide-react";

export default function Footer({
  scrollToBooking,
}: {
  scrollToBooking: () => void;
}) {
  const info = useClinicInfo();
  return (
    <footer
      id="contact"
      className="border-t border-brand-800 bg-brand-700 text-brand-100"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Brand dark />

            <p className="mt-4 text-sm leading-relaxed">
              Танд болон таны гэр бүлд чанартай, сэтгэл ханамжтай шүдний тусламж
              үйлчилгээг үзүүлэхэд бид бэлэн байна.
            </p>
          </div>

          {/* Opening hours */}
          <div>
            <h4 className="font-bold text-white">Цагийн хуваарь</h4>

            <p className="mt-4 text-sm whitespace-pre-line">{info.workingHoursNote}</p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-white">Холбоо барих</h4>

            <ul className="mt-4 space-y-4 text-sm">
              <li>
                <a
                  href={`tel:${info.phone}`}
                  className="flex items-center gap-2 transition-colors hover:text-white"
                >
                  <Phone className="h-4 w-4 shrink-0 text-accent" />
                  <span>{info.phone}</span>
                </a>
              </li>

              <li><a href={`mailto:${info.email}`}>{info.email}</a></li>
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 transition-colors hover:text-white"
                >
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />

                  <span>{info.address}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Booking */}
          <div>
            <h4 className="font-bold text-white">Онлайн цаг захиалга</h4>

            <button
              onClick={scrollToBooking}
              className="mt-4 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-500"
            >
              Одоо цаг авах
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-white/15 pt-8 text-center text-xs text-brand-100">
          © {new Date().getFullYear()} {info.clinicName}. Бүх эрх хуулиар
          хамгаалагдсан.
          <div className="mt-2 lg:hidden">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center px-3 text-[11px] text-brand-200 transition hover:text-white focus-visible:text-white"
            >
              Ажилтны нэвтрэх
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
