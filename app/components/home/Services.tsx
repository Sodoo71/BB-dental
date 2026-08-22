"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: string | number | null;
  description?: string | null;
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

  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-20">
      <div className="text-center">
        <p className="text-xs font-black tracking-widest text-cyan-600">
          МЭРГЭЖЛИЙН ҮЙЛЧИЛГЭЭ
        </p>
        <h2 className="mt-3 text-3xl font-black sm:text-4xl">
          Манай эмнэлгийн үйлчилгээнүүд
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Таны шүдний бүх төрлийн хэрэгцээнд зориулсан комплекс эмчилгээ.
        </p>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
      ) : error ? (
        <p className="mt-12 text-center text-sm font-bold text-red-500">
          Үйлчилгээний мэдээллийг ачаалж чадсангүй.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-8 transition hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 transition group-hover:bg-cyan-600 group-hover:text-white">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-black">{item.name}</h3>
                
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                <span>⏱ {item.durationMin} мин</span>
                <span className="text-sm font-black text-cyan-600">
                  {item.price
                    ? `${String(item.price).toLocaleString()}₮`
                    : "Үнэ тодорхойгүй"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
