"use client";

import { useState } from "react";
import PublicClinic from "./public-clinic";
import Hero from "./home/Hero";
import { ClinicLogo } from "./clinic-branding";

function Icon({ name }: { name: "phone" | "pin" }) {
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
      {name === "phone" ? (
        <path d="M21 16v4a1 1 0 0 1-1 1C10 21 3 14 3 4a1 1 0 0 1 1-1h4l1 5-3 2a16 16 0 0 0 8 8l2-3Z" />
      ) : (
        <>
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </>
      )}
    </svg>
  );
}
function Brand({ name = "BB Dental Clinic" }: { name?: string }) {
  return (
    <a href="#home" className="brand" aria-label="BB Dental Clinic нүүр хуудас">
      <ClinicLogo
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
export default function HomePage() {
  const [clinic, setClinic] = useState<Record<string, string>>({});
  const contactPhone = clinic.phone || "9596-3531";
  const tel = `tel:+976${contactPhone.replace(/\D/g, "").replace(/^976/, "")}`;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="public-home">
      <header className="site-header">
        <div className="header-inner">
          <Brand name={clinic.clinicName} />
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
            <a href="#services" onClick={() => setMenuOpen(false)}>
              Үйлчилгээ
            </a>
            <a href="#doctors" onClick={() => setMenuOpen(false)}>
              Эмч нар
            </a>
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
        <Hero clinicName={clinic.clinicName} />
        <PublicClinic onClinic={setClinic} />
      </main>
      <footer className="site-footer" id="contact">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-about">
              <Brand name={clinic.clinicName} />
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
    </div>
  );
}
