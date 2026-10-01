"use client";
import { ClinicImage } from "@/components/ui/ClinicImage";

import React, { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Search, Sparkles } from "lucide-react";

type Service = {
  id: string;
  name: string;
  category?: string | null;
  durationMin: number | string;
  price: string | number | null;
  description?: string | null;
  imageUrl?: string | null;
};

const categoryLabels: Record<string, string> = {
  ALL: "Бүгд",
  GENERAL: "Ерөнхий үзлэг",
  PREVENTION: "Урьдчилан сэргийлэлт",
  TREATMENT: "Эмчилгээ",
  COSMETIC: "Гоо сайхан",
  SURGERY: "Мэс ажилбар",
};

export default function Services({ onBook }: { onBook: (serviceId: string) => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [activeCategory, setActiveCategory] = useState("ALL");

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

  const categories = [
    "ALL",
    ...Array.from(
      new Set(services.map((service) => service.category || "GENERAL")),
    ),
  ];
  const visibleServices = services.filter(
    (service) =>
      (activeCategory === "ALL" ||
      (service.category || "GENERAL") === activeCategory) && service.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <section id="services" className="mx-auto max-w-7xl px-3 py-12 sm:px-4 sm:py-20">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-brand-600 uppercase">
          МЭРГЭЖЛИЙН ҮЙЛЧИЛГЭЭ
        </p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl text-slate-900">
          Манай эмнэлгийн үйлчилгээнүүд
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-slate-600">
          Таны шүдний эрүүл мэнд, гоо зүйн бүх төрлийн хэрэгцээнд зориулсан
          орчин үеийн цогц эмчилгээ.
        </p>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : error ? (
        <p className="mt-12 text-center text-sm font-bold text-red-500">
          Үйлчилгээний мэдээллийг ачаалж чадсангүй.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-10">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => { setActiveCategory(category); setPage(0); }}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                  activeCategory === category
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {categoryLabels[category] || category}
              </button>
            ))}
          </div>

          <label className="mx-auto mt-5 flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={18} className="shrink-0 text-brand-600" /><input type="search" aria-label="Үйлчилгээ хайх" placeholder="Үйлчилгээний нэрээр хайх…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="w-full bg-transparent py-3 outline-none" /></label>
          <div id="service-catalog" className="mt-5 grid grid-cols-3 gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {visibleServices.slice(page * 9, (page + 1) * 9).map((item) => (
              <div
                key={item.id}
                className="group flex min-w-0 flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/10"
              >
                <div>
                  {/* Image or Icon Cover */}
                  {item.imageUrl ? (
                    <div className="relative h-20 w-full overflow-hidden sm:h-48 bg-slate-100">
                      <ClinicImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
                    </div>
                  ) : (
                    <div className="relative flex h-20 w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-brand-50 via-slate-50 to-brand-50 px-1 sm:h-36 sm:flex-row sm:justify-between sm:px-8">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-14 sm:w-14 sm:rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition-transform group-hover:scale-110">
                        <Sparkles className="h-4 w-4 sm:h-7 sm:w-7" />
                      </div>
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs font-bold text-brand-800  shadow-sm">
                        {item.durationMin} мин
                      </span>
                    </div>
                  )}

                  <div className="p-2 sm:p-7">
                    <h3 className="text-[11px] leading-snug font-semibold text-slate-900 [overflow-wrap:anywhere] group-hover:text-brand-700 transition sm:text-xl">
                      {item.name}
                    </h3>

                    <p className="mt-3 hidden text-xs leading-relaxed text-slate-600 sm:line-clamp-3">
                      {item.description ||
                        "Шүдний мэргэжлийн өндөр түвшний үзлэг, оношилгоо, чанартай эмчилгээний үйлчилгээ."}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 p-1.5 sm:p-6">
                  <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">
                        Үнэ тариф
                      </span>
                      <span className="block text-center text-[11px] font-semibold text-slate-900 [overflow-wrap:anywhere] sm:text-left sm:text-base">
                        {item.price
                          ? `${String(item.price).toLocaleString()}₮`
                          : "Үнэ тодорхойгүй"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onBook(item.id)}
                      aria-label={`${item.name} — цаг авах`}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-1 py-2 text-[11px] sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-500"
                    >
                      <span>Цаг авах</span>
                      <ArrowRight className="hidden h-3.5 w-3.5 sm:block" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!visibleServices.length && <p role="status" className="py-8 text-center text-sm text-slate-500">Хайлтад тохирох үйлчилгээ олдсонгүй.</p>}
          {visibleServices.length > 9 && <nav aria-label="Үйлчилгээний хуудас" className="mt-5 flex items-center justify-center gap-4">
            <button type="button" aria-label="Өмнөх үйлчилгээний хуудас" disabled={page === 0} onClick={() => { setPage(page - 1); document.getElementById("service-catalog")?.scrollIntoView({ behavior: "instant" }); }} className="button-secondary disabled:opacity-40"><ChevronLeft size={18} /></button>
            <span aria-live="polite" className="text-xs text-slate-600">{page + 1} / {Math.ceil(visibleServices.length / 9)}</span>
            <button type="button" aria-label="Дараах үйлчилгээний хуудас" disabled={(page + 1) * 9 >= visibleServices.length} onClick={() => { setPage(page + 1); document.getElementById("service-catalog")?.scrollIntoView({ behavior: "instant" }); }} className="button-secondary disabled:opacity-40"><ChevronRight size={18} /></button>
          </nav>}
        </>
      )}
    </section>
  );
}
