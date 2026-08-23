"use client";

import React from "react";
import Navbar from "./components/layout/Navbar";
import Hero from "./components/home/Hero";

import Services from "./components/home/Services";
import BookingSection from "./components/booking/BookingSection";
import Footer from "./components/layout/Footer";

export default function Home() {
  const scrollToBooking = () => {
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main>
      <div className="min-h-screen bg-slate-50 text-slate-900 scroll-smooth">
        <Navbar scrollToBooking={scrollToBooking} />
        <Hero scrollToBooking={scrollToBooking} />
        
        <Services />
        <BookingSection />
        <Footer scrollToBooking={scrollToBooking} />
      </div>
    </main>
  );
}
