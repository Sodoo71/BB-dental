"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ChevronLeft, ChevronRight, CalendarDays, Smile, Stethoscope, HeartHandshake } from "lucide-react";
import { useClinicInfo } from "@/components/layout/ClinicInfoProvider";
import styles from "./Hero.module.css";

const cards = [
  { title: "Таны инээмсэглэл, бидний халамж", label: "BB DENTAL CLINIC", icon: Smile, href: "#booking", logo: true },
  { title: "Танд тохирох үйлчилгээ", label: "ҮЙЛЧИЛГЭЭ", icon: Stethoscope, href: "#services" },
  { title: "Эмчтэйгээ танилцаарай", label: "МАНАЙ ЭМЧ НАР", icon: HeartHandshake, href: "#doctors" },
  { title: "Өөрт тохирох цагаа сонгоорой", label: "ОНЛАЙН ЦАГ ЗАХИАЛГА", icon: CalendarDays, href: "#booking" },
  { title: "Бид тантай ойрхон", label: "ХОЛБОО БАРИХ", icon: Smile, href: "#contact" },
];

export default function Hero({ scrollToBooking }: { scrollToBooking: () => void }) {
  const info = useClinicInfo();
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => (current + direction + cards.length) % cards.length);

  return (
    <header className={styles.hero}>
      <div className={styles.layout}>
        <div className={styles.intro}>
          <p className="eyebrow mb-7 flex items-center gap-3"><span className="h-px w-9 bg-brand-500" />{info.clinicName}</p>
          <p className={styles.wordmark}>BB Dental<span>CLINIC & CARE</span></p>
          <h1 className={styles.headline}>Эрүүл инээмсэглэл.<br />Танд зориулсан халамж.</h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-600">Шүдний эрүүл мэнддээ цаг гаргаарай. Үйлчилгээ, эмч болон өөрт тохирох цагаа сонгон үзлэгийн захиалгаа хялбар бүртгүүлээрэй.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={scrollToBooking} className={styles.primary}>Үзлэгийн цаг авах<ArrowUpRight size={18} /></button>
            <a href="#services" className={styles.secondary}>Үйлчилгээ үзэх</a>
          </div>
        </div>
        <section className={styles.showcase} aria-label="Эмнэлгийн танилцуулга" aria-roledescription="карусель">
          <div className={styles.deck}>
            {cards.map((card, index) => {
              const offset = ((index - active + cards.length + 2) % cards.length) - 2;
              const Icon = card.icon;
              return (
                <a key={card.label} href={card.href} className={`${styles.card} ${card.logo ? styles.logoCard : ""}`} data-position={offset} tabIndex={offset === 0 ? 0 : -1} aria-hidden={offset !== 0} aria-label={`${card.title} — дэлгэрэнгүй`}>
                  {card.logo ? <Image src={info.logoUrl || "/images/bb-dental-logo.jpg"} alt={`${info.clinicName} лого`} width={480} height={480} preload unoptimized className={styles.logo} /> : <div className={styles.illustration}><span className={styles.iconRing}><Icon size={76} strokeWidth={1} /></span><span className={styles.cardBrand}>BB Dental</span></div>}
                  <div className={styles.caption}><p>{card.label}</p><h2>{card.title}</h2><ArrowUpRight size={20} aria-hidden="true" /></div>
                </a>
              );
            })}
          </div>
          <p className={styles.hint}>← ШИЛЖҮҮЛЭХ · ДАРЖ ДЭЛГЭРЭНГҮЙ →</p>
          <div className={styles.controls}>
            <button type="button" onClick={() => move(-1)} aria-label="Өмнөх карт"><ChevronLeft size={20} /></button>
            <span className="text-xs tabular-nums text-brand-700" aria-live="polite" aria-atomic="true"><span className="sr-only">{cards[active].title}, </span>0{active + 1} / 0{cards.length}</span>
            <button type="button" onClick={() => move(1)} aria-label="Дараах карт"><ChevronRight size={20} /></button>
          </div>
        </section>
      </div>
    </header>
  );
}
