"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Stethoscope } from "lucide-react";
import { ClinicLogo } from "../clinic-branding";
import "./hero.css";
export default function Hero({
  clinicName = "BB Dental Clinic",
}: {
  clinicName?: string;
}) {
  return (
    <section
      id="home"
      className="bloom-hero"
      aria-label="BB Dental Clinic танилцуулга"
    >

      <div className="bloom-wordmark" aria-hidden="true">
        BB DENTAL<span>CLINIC & CARE</span>
      </div>
      <div className="bloom-hero-feature">
        <div className="bloom-hero-copy">
          <p className="eyebrow">{clinicName}</p>
          <h2>
            Эрүүл инээмсэглэл.
          </h2>
          <p>
            Үйлчилгээ, эмч болон өөрт тохирох цагаа сонгон үзлэгийн захиалгаа
            хялбар бүртгүүлээрэй.
          </p>
          <div className="bloom-hero-actions">
            <Link href="/booking" className="bloom-book">
              Үзлэгийн цаг авах <ArrowUpRight size={20} />
            </Link>
            <a href="#services">Үйлчилгээ үзэх ↗</a>
          </div>
        </div>
        <div className="bloom-hero-emblem">
          <ClinicLogo
            width={320}
            height={320}
            alt={`${clinicName} лого`}
            className="hero-logo"
            preload
          />
        
        </div>
      </div>
      <div className="bloom-hero-links">
        <Link href="/booking">
          <CalendarDays size={20} />
          <span>
            Өөрт тохирох өдөр, цаг<strong>Онлайнаар цаг захиалах</strong>
          </span>
          <ArrowUpRight size={20} />
        </Link>
        <a href="#doctors">
          <Stethoscope size={20} />
          <span>
           Мэргэжлийн баг<strong>Эмч нартайгаа танилцах</strong>
          </span>
          <ArrowUpRight size={20} />
        </a>
      </div>
    </section>
  );
}
