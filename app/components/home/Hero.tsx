"use client";

import { useState } from "react";
import { ClinicLogo } from "../clinic-branding";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Smile,
  Stethoscope,
  HeartHandshake,
} from "lucide-react";
import "./hero.css";

const cards = [
  {
    title: "Таны инээмсэглэл, бидний халамж",
    label: "BB DENTAL CLINIC",
    icon: Smile,
    href: "#booking",
    logo: true,
  },
  {
    title: "Танд тохирох үйлчилгээ",
    label: "ҮЙЛЧИЛГЭЭ",
    icon: Stethoscope,
    href: "#services",
  },
  {
    title: "Эмчтэйгээ танилцаарай",
    label: "МАНАЙ ЭМЧ НАР",
    icon: HeartHandshake,
    href: "#doctors",
  },
  {
    title: "Өөрт тохирох цагаа сонгоорой",
    label: "ОНЛАЙН ЦАГ ЗАХИАЛГА",
    icon: CalendarDays,
    href: "#booking",
  },
  {
    title: "Бид тантай ойрхон",
    label: "ХОЛБОО БАРИХ",
    icon: Smile,
    href: "#contact",
  },
];

export default function Hero({
  clinicName = "BB Dental Clinic",
}: {
  clinicName?: string;
}) {
  const scrollToBooking = () =>
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  const [active, setActive] = useState(0);
  const move = (direction: number) =>
    setActive((current) => (current + direction + cards.length) % cards.length);

  return (
    <section
      id="home"
      className="v2-hero-hero"
      aria-label="BB Dental Clinic танилцуулга"
    >
      <div className="v2-hero-layout">
        <div className="v2-hero-intro">
          <p className="v2-hero-eyebrow">
            <span />
            {clinicName}
          </p>
          <p className="v2-hero-wordmark">
            BB Dental<span>CLINIC & CARE</span>
          </p>
          <h1 className="v2-hero-headline">
            Эрүүл инээмсэглэл.
            <br />
            Танд зориулсан халамж.
          </h1>
          <p className="v2-hero-description">
            Шүдний эрүүл мэнддээ цаг гаргаарай. Үйлчилгээ, эмч болон өөрт
            тохирох цагаа сонгон үзлэгийн захиалгаа хялбар бүртгүүлээрэй.
          </p>
          <div className="v2-hero-actions">
            <button
              type="button"
              onClick={scrollToBooking}
              className="v2-hero-primary"
            >
              Үзлэгийн цаг авах
              <ArrowUpRight size={18} />
            </button>
            <a href="#services" className="v2-hero-secondary">
              Үйлчилгээ үзэх
            </a>
          </div>
        </div>
        <section
          className="v2-hero-showcase"
          aria-label="Эмнэлгийн танилцуулга"
          aria-roledescription="карусель"
        >
          <div className="v2-hero-deck">
            {cards.map((card, index) => {
              const offset =
                ((index - active + cards.length + 2) % cards.length) - 2;
              const Icon = card.icon;
              return (
                <a
                  key={card.label}
                  href={card.href}
                  className={`v2-hero-card ${card.logo ? "v2-hero-logoCard" : ""}`}
                  data-position={offset}
                  tabIndex={offset === 0 ? 0 : -1}
                  aria-hidden={offset !== 0}
                  aria-label={`${card.title} — дэлгэрэнгүй`}
                >
                  {card.logo ? (
                    <ClinicLogo
                      alt={`${clinicName} лого`}
                      width={480}
                      height={480}
                      preload
                      className={`v2-hero-logo hero-logo`}
                    />
                  ) : (
                    <div className="v2-hero-illustration">
                      <span className="v2-hero-iconRing">
                        <Icon size={76} strokeWidth={1} />
                      </span>
                      <span className="v2-hero-cardBrand">BB Dental</span>
                    </div>
                  )}
                  <div className="v2-hero-caption">
                    <p>{card.label}</p>
                    <h2>{card.title}</h2>
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </div>
                </a>
              );
            })}
          </div>
          <p className="v2-hero-hint">← ШИЛЖҮҮЛЭХ · ДАРЖ ДЭЛГЭРЭНГҮЙ →</p>
          <div className="v2-hero-controls">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Өмнөх карт"
            >
              <ChevronLeft size={20} />
            </button>
            <span
              className="v2-hero-counter"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="v2-hero-srOnly">{cards[active].title}, </span>0
              {active + 1} / 0{cards.length}
            </span>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Дараах карт"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
