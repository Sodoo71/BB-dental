"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Loader2, Sparkles, Stethoscope, User } from "lucide-react";

type DoctorItem = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
};

export default function DoctorsSection() {
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/doctors")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDoctors(data.data ?? []);
      })
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, []);

  const handleBookDoctor = (doctorId: string) => {
    const bookingEl = document.getElementById("booking");
    if (bookingEl) {
      bookingEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!loading && doctors.length === 0) {
    return null;
  }

  return (
    <section id="doctors" className="mx-auto max-w-7xl px-4 py-20">
      <div className="text-center">
        <p className="text-xs font-black tracking-widest text-emerald-600 uppercase">
          МЭРГЭЖЛИЙН БАГ
        </p>
        <h2 className="mt-3 text-3xl font-black sm:text-4xl text-slate-900">
          Манай чадварлаг их эмч нар
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-slate-600">
          Шүдний эмчилгээ, гоо сайхны салбарт мэргэшсэн туршлагатай эмч нарын баг хамт олон танд үйлчилж байна.
        </p>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {doctors.map((doctor) => {
            const photoUrl = doctor.avatarUrl || doctor.imageUrl;

            return (
              <div
                key={doctor.id}
                className="group flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/10"
              >
                <div>
                  {/* Photo cover */}
                  {photoUrl ? (
                    <div className="relative h-64 w-full overflow-hidden bg-slate-100">
                      <img
                        src={photoUrl}
                        alt={doctor.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
                    </div>
                  ) : (
                    <div className="relative flex h-60 w-full items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-cyan-50">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform group-hover:scale-110">
                        <Stethoscope className="h-10 w-10" />
                      </div>
                    </div>
                  )}

                  <div className="p-6 text-center">
                    <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      {doctor.title || "Шүдний их эмч"}
                    </span>

                    <h3 className="mt-3 text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                      {doctor.name}
                    </h3>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                  <button
                    type="button"
                    onClick={() => handleBookDoctor(doctor.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-600"
                  >
                    <span>Цаг захиалах</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
