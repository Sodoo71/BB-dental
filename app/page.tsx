"use client";

import { ClinicInfoProvider } from "@/components/layout/ClinicInfoProvider";
import React, { useRef } from "react";
import Navbar from "./components/layout/Navbar";
import Hero from "./components/home/Hero";

import Services from "./components/home/Services";
import DoctorsSection from "./components/home/DoctorsSection";
import BookingSection, { type BookingHandle } from "./components/booking/BookingSection";
import Footer from "./components/layout/Footer";

export default function Home() {
  const bookingRef = useRef<BookingHandle>(null);
  const scrollToBooking = () => {
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <ClinicInfoProvider><main>
      <div className="min-h-screen bg-slate-50 text-slate-900 scroll-smooth">
        <Navbar scrollToBooking={scrollToBooking} />
        <Hero scrollToBooking={scrollToBooking} />
        <Services onBook={(serviceId) => bookingRef.current?.select({ serviceId })} />
        <DoctorsSection onBook={(doctorId) => bookingRef.current?.select({ doctorId })} />
        <BookingSection ref={bookingRef} />
        <Footer scrollToBooking={scrollToBooking} />
      </div>
    </main></ClinicInfoProvider>
  );
}
