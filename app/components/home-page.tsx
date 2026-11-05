"use client";

import Image from "next/image";
import { useState } from "react";
import PublicClinic from "./public-clinic";

type IconName =
  | "phone"
  | "pin"
  | "search"
  | "arrow"
  | "left"
  | "right"
  | "tooth"
  | "calendar"
  | "person";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    phone: (
      <path d="M21 16v4a1 1 0 0 1-1 1C10 21 3 14 3 4a1 1 0 0 1 1-1h4l1 5-3 2a16 16 0 0 0 8 8l2-3Z" />
    ),
    pin: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    arrow: <path d="M5 19 19 5M5 5h14v14" />,
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    tooth: (
      <path d="M12 5C5-1 1 6 5 13c2 4 1 9 4 9 2 0 0-8 3-8s1 8 3 8c3 0 2-5 4-9 4-7 0-14-7-8Z" />
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="17" rx="3" />
        <path d="M7 2v6m10-6v6M3 11h18m-13 5h2m4 0h2" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3m-8-6v6m-3-3h6" />
      </>
    ),
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Brand({
  name = "BB Dental Clinic",
  logoUrl,
}: {
  name?: string;
  logoUrl?: string;
}) {
  return (
    <a href="#home" className="brand" aria-label="BB Dental Clinic нүүр хуудас">
      <Image
        src={logoUrl || "/images/bb-dental-logo.jpg"}
        width={60}
        height={60}
        alt="BB Dental лого"
        className="brand-logo"
      />
      <span>
        <span className="brand-name">{name}</span>
        <span className="brand-caption">CLINIC & CARE</span>
      </span>
    </a>
  );
}
const cards = [
  {
    eyebrow: "BB DENTAL CLINIC",
    title: "Таны инээмсэглэл, бидний халамж",
    icon: "tooth",
    href: "#booking",
  },
  {
    eyebrow: "МАНАЙ ҮЙЛЧИЛГЭЭ",
    title: "Эрүүл шүд, итгэлтэй инээмсэглэл",
    icon: "tooth",
    href: "#booking",
  },
  {
    eyebrow: "МАНАЙ ЭМЧ НАР",
    title: "Таны төлөө мэргэжлийн баг",
    icon: "person",
    href: "#booking",
  },
  {
    eyebrow: "ОНЛАЙН ЦАГ ЗАХИАЛГА",
    title: "Өөрт тохирох цагаа сонгоорой",
    icon: "calendar",
    href: "#booking",
  },
  {
    eyebrow: "ХОЛБОО БАРИХ",
    title: "Бид тантай үргэлж ойр",
    icon: "phone",
    href: "#contact",
  },
] as const;

export default function HomePage() {
  const [active, setActive] = useState(0);
  const [clinic, setClinic] = useState<Record<string, string>>({});
  const contactPhone = clinic.phone || "9596-3531";
  const tel = `tel:+976${contactPhone.replace(/\D/g, "").replace(/^976/, "")}`;
  const [menuOpen, setMenuOpen] = useState(false);
  function showCard(index: number) {
    setActive(index);
    setMenuOpen(false);
    document
      .getElementById(
        index === 1 ? "services" : index === 2 ? "doctors" : "home",
      )
      ?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Brand name={clinic.clinicName} logoUrl={clinic.logoUrl} />
          <button
            className="menu-toggle"
            aria-label={menuOpen ? "Цэс хаах" : "Цэс нээх"}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          <nav
            id="main-nav"
            className={`main-nav ${menuOpen ? "is-open" : ""}`}
            aria-label="Үндсэн цэс"
          >
            <button onClick={() => showCard(1)}>Үйлчилгээ</button>
            <button onClick={() => showCard(2)}>Эмч нар</button>
            <a href="#booking" onClick={() => setMenuOpen(false)}>
              Цаг захиалга
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>
              Холбоо барих
            </a>
            <a href="/login" className="mobile-staff-link">
              Ажилтны нэвтрэх
            </a>
          </nav>
          <div className="header-actions">
            <a className="staff-access" href="/login">
              Ажилтны нэвтрэх
            </a>
            <a href={tel} className="phone-link">
              <Icon name="phone" />
              <span>+976 {contactPhone}</span>
            </a>
            <a href="#booking" className="button header-book">
              Цаг авах
            </a>
          </div>
        </div>
      </header>
      <main>
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow hero-eyebrow">
                <span /> BB DENTAL CLINIC
              </p>
              <h1 id="hero-title">BB Dental</h1>
              <p className="hero-caption">CLINIC & CARE</p>
              <h2>
                Эрүүл инээмсэглэл.
                <br />
                Танд зориулсан халамж.
              </h2>
              <p className="hero-description">
                Шүдний эрүүл мэнддээ цаг гаргаарай. Үйлчилгээ, эмч болон өөрт
                тохирох цагаа сонгон үзлэгийн захиалгаа хялбар бүртгүүлээрэй.
              </p>
              <div className="hero-actions">
                <a className="button button-pill" href="#booking">
                  Үзлэгийн цаг авах <Icon name="arrow" />
                </a>
                <a className="button button-outline" href="#services">
                  Үйлчилгээ үзэх
                </a>
              </div>
            </div>
            <div
              className="carousel"
              aria-roledescription="carousel"
              aria-label="Эмнэлгийн танилцуулга"
            >
              <div className="card-stack">
                {cards.map((card, index) => {
                  const offset = ((index - active + 7) % 5) - 2;
                  return (
                    <a
                      key={card.eyebrow}
                      href={card.href}
                      className={`feature-card ${index === active ? "is-active" : ""}`}
                      style={
                        {
                          transform: `translateX(calc(-50% + ${offset * 39}%)) scale(${1 - Math.abs(offset) * 0.105}) rotate(${offset * 2.6}deg)`,
                          zIndex: 5 - Math.abs(offset),
                        } as React.CSSProperties
                      }
                      tabIndex={index === active ? 0 : -1}
                      aria-hidden={index !== active}
                      onClick={(event) => {
                        if (index !== active) {
                          event.preventDefault();
                          setActive(index);
                        }
                      }}
                    >
                      <div className="card-art">
                        {index === 0 ? (
                          <Image
                            src={clinic.logoUrl || "/images/bb-dental-logo.jpg"}
                            alt="BB Dental Clinic"
                            width={310}
                            height={310}
                            priority
                            className="hero-logo"
                          />
                        ) : (
                          <div className="icon-orbit">
                            <Icon name={card.icon} />
                            <span>BB Dental</span>
                          </div>
                        )}
                      </div>
                      <div className="card-shade" />
                      <div className="card-caption">
                        <p>{card.eyebrow}</p>
                        <h3>{card.title}</h3>
                        <Icon name="arrow" />
                      </div>
                    </a>
                  );
                })}
              </div>
              <p className="carousel-hint">← ШИЛЖҮҮЛЭХ · ДАРЖ ДЭЛГЭРЭНГҮЙ →</p>
              <div className="carousel-controls">
                <button
                  aria-label="Өмнөх карт"
                  onClick={() => setActive((active + 4) % 5)}
                >
                  <Icon name="left" />
                </button>
                <span aria-live="polite">0{active + 1} / 05</span>
                <button
                  aria-label="Дараах карт"
                  onClick={() => setActive((active + 1) % 5)}
                >
                  <Icon name="right" />
                </button>
              </div>
            </div>
          </div>
        </section>
        <PublicClinic onClinic={setClinic} />
      </main>
      <footer className="site-footer" id="contact">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-about">
              <Brand name={clinic.clinicName} logoUrl={clinic.logoUrl} />
              <p>
                {clinic.footerDescription ||
                  "Танд болон таны гэр бүлд чанартай, сэтгэл ханамжтай шүдний тусламж үйлчилгээг үзүүлэхэд бид бэлэн байна."}
              </p>
            </div>
            <div>
              <h2>{clinic.footerHoursTitle || "Цагийн хуваарь"}</h2>
              <p>
                {clinic.hours ||
                  "Даваа - Баасан: 09:00 - 19:00 | Бямба - Ням: 10:00 - 18:00"}
              </p>
            </div>
            <div className="footer-contact">
              <h2>{clinic.footerContactTitle || "Холбоо барих"}</h2>
              <a href={tel}>
                <Icon name="phone" />
                +976 {contactPhone}
              </a>
              <a
                className="email"
                href={`mailto:${clinic.email || "sodoosodbileg71@gmail.com"}`}
              >
                {clinic.email || "sodoosodbileg71@gmail.com"}
              </a>
              <p className="address">
                <Icon name="pin" />
                <span>
                  {clinic.address ||
                    "БГД, 12-р хороо, 3, 4-р хороолол, Бичлийн аркны автобусны буудал дээр, Азифармтай эмийн сангийн 3 давхарт, BB Dental Clinic"}
                </span>
              </p>
            </div>
            <div>
              <h2>{clinic.footerBookingTitle || "Онлайн цаг захиалга"}</h2>
              <a className="button footer-book" href="#booking">
                {clinic.footerBookingLabel || "Одоо цаг авах"}
              </a>
            </div>
          </div>
          {(clinic.facebookUrl || clinic.instagramUrl) && (
            <div className="footer-social-links">
              {clinic.facebookUrl && (
                <a href={clinic.facebookUrl} target="_blank" rel="noreferrer">
                  Facebook ↗
                </a>
              )}
              {clinic.instagramUrl && (
                <a href={clinic.instagramUrl} target="_blank" rel="noreferrer">
                  Instagram ↗
                </a>
              )}
            </div>
          )}
          <div className="copyright">
            {clinic.copyrightText ||
              "© 2026 BB Dental Clinic. Бүх эрх хуулиар хамгаалагдсан."}
          </div>
        </div>
      </footer>
    </>
  );
}
