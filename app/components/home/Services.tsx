"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Clock, Loader2, Sparkles } from "lucide-react";

type Service = {
  id: string;
  name: string;
  durationMin: number | string;
  price: string | number | null;
  description?: string | null;
  imageUrl?: string | null;
};

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/services")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setServices(data.data ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleBookService = (serviceId: string) => {
    const bookingEl = document.getElementById("booking");
    if (bookingEl) {
      bookingEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-20">
      <div className="text-center">
        <p className="text-xs font-black tracking-widest text-cyan-600 uppercase">
          МЭРГЭЖЛИЙН ҮЙЛЧИЛГЭЭ
        </p>
        <h2 className="mt-3 text-3xl font-black sm:text-4xl text-slate-900">
          Манай эмнэлгийн үйлчилгээнүүд
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-slate-600">
          Таны шүдний эрүүл мэнд, гоо зүйн бүх төрлийн хэрэгцээнд зориулсан орчин үеийн цогц эмчилгээ.
        </p>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      ) : error ? (
        <p className="mt-12 text-center text-sm font-bold text-red-500">
          Үйлчилгээний мэдээллийг ачаалж чадсангүй.
        </p>
      ) : (
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-500/10"
            >
              <div>
                {/* Image or Icon Cover */}
                {item.imageUrl ? (
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
                  </div>
                ) : (
                  <div className="relative flex h-36 w-full items-center justify-between bg-gradient-to-br from-cyan-50 via-slate-50 to-blue-50 px-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 transition-transform group-hover:scale-110">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-cyan-800 backdrop-blur-sm shadow-sm">
                      {item.durationMin} мин
                    </span>
                  </div>
                )}

                <div className="p-7">
                  <h3 className="text-xl font-black text-slate-900 group-hover:text-cyan-700 transition">
                    {item.name}
                  </h3>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600 line-clamp-3">
                    {item.description ||
                      "Шүдний мэргэжлийн өндөр түвшний үзлэг, оношилгоо, чанартай эмчилгээний үйлчилгээ."}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Үнэ тариф
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {item.price
                        ? `${String(item.price).toLocaleString()}₮`
                        : "Үнэ тодорхойгүй"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBookService(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-cyan-600/20 transition hover:bg-cyan-500"
                  >
                    <span>Цаг авах</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
