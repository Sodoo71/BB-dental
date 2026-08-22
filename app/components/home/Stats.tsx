"use client";
import React from "react";
import { Users, Award, ShieldCheck, Stethoscope } from "lucide-react";

export default function Stats() {
  return (
    <section className="border-y border-slate-200 bg-white py-10">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 md:grid-cols-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">10,000+</p>
            <p className="text-xs font-bold text-slate-500">
              Сэтгэл ханамжтай үйлчлүүлэгч
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">12+ Жил</p>
            <p className="text-xs font-bold text-slate-500">Ажлын туршлага</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">100%</p>
            <p className="text-xs font-bold text-slate-500">
              Ариутгалын баталгаа
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">8+</p>
            <p className="text-xs font-bold text-slate-500">
              Мэргэшсэн эмч нар
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
