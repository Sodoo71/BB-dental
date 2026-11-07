import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import PublicClinic from "../components/public-clinic";
import { ClinicLogo } from "../components/clinic-branding";

export const metadata: Metadata = {
  title: "Цаг захиалга | BB Dental Clinic",
  description:
    "Үйлчилгээгээ хайж, эмч болон боломжтой өдөр, цагаа сонгон үзлэгийн захиалга өгөөрэй.",
};
export default function BookingPage() {
  return (
    <div className="public-home booking-page">
      <header className="booking-page-header">
        <Link href="/" className="booking-page-brand">
          <ClinicLogo width={42} height={42} alt="BB Dental Clinic" />
          <strong>BB Dental Clinic</strong>
        </Link>
        <Link href="/" className="booking-back-home">
          <ArrowLeft size={16} /> Нүүр хуудас
        </Link>
      </header>
      <main>
        <Suspense
          fallback={
            <div className="erp-loading">Цаг захиалга ачаалж байна…</div>
          }
        >
          <PublicClinic />
        </Suspense>
      </main>
      <footer className="booking-page-footer">
        BB Dental Clinic · Таны инээмсэглэлийн төлөө
      </footer>
    </div>
  );
}
