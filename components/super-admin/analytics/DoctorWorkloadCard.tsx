"use client";

import React from "react";
import { Stethoscope } from "lucide-react";
import { ClinicImage } from "@/components/ui/ClinicImage";
import type { DoctorStat } from "@/types/dashboard";

interface DoctorWorkloadCardProps {
  doctors: DoctorStat[];
}

export function DoctorWorkloadCard({ doctors }: DoctorWorkloadCardProps) {
  return (
    <div className="dashboard-card h-full">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Эмч нарын ажлын ачаалал & Гүйцэтгэл
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Хуваарилагдсан нийт цаг, дуусгасан үзлэгийн харьцаа
          </p>
        </div>
      </div>

      <div className="mt-4 h-72 space-y-2 overflow-y-auto pr-1" role="region" aria-label="Эмчийн ачааллын жагсаалт" tabIndex={0}>
        {doctors.length === 0 && <p className="py-4 text-sm text-slate-500">Одоогоор эмчийн ачааллын мэдээлэл байхгүй байна.</p>}
        {doctors.map((doctor) => {
          const completionRate =
            doctor.totalAppointments > 0
              ? Math.round(
                  (doctor.completedCount / doctor.totalAppointments) * 100,
                )
              : 0;

          return (
            <div
              key={doctor.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white overflow-hidden">
                  {doctor.avatarUrl ? (
                    <ClinicImage
                      src={doctor.avatarUrl}
                      alt={doctor.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    doctor.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-slate-900" title={doctor.name}>
                    {doctor.name}
                  </h4>
                  <p className="truncate text-sm text-slate-500" title={doctor.title || "Их эмч"}>
                    {doctor.title || "Их эмч"}
                  </p>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-3 gap-3 text-center sm:w-52">
                <div>
                  <span className="text-sm font-semibold text-slate-400">
                    Нийт
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {doctor.totalAppointments}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-emerald-600">
                    Дууссан
                  </span>
                  <p className="text-sm font-semibold text-emerald-600">
                    {doctor.completedCount}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-semibold text-brand-600">
                    Хувь
                  </span>
                  <p className="text-sm font-semibold text-brand-600">
                    {completionRate}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
