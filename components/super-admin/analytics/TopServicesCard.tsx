"use client";

import React from "react";
import { Award } from "lucide-react";
import type { TopServiceStat } from "@/types/dashboard";

interface TopServicesCardProps {
  services: TopServiceStat[];
}

export function TopServicesCard({ services }: TopServicesCardProps) {
  const maxCount = Math.max(...services.map((s) => s.count), 1);

  const formatMNT = (amount: number) => {
    return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
  };

  return (
    <div className="dashboard-card h-full">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Award className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Эрэлттэй үйлчилгээнүүд (ТОП 5)
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Захиалгын тоо болон орлогод эзлэх хувиар эрэмбэлэгдсэн
          </p>
        </div>
      </div>

      <div className="mt-4 h-72 space-y-3 overflow-y-auto pr-1" role="region" aria-label="Эрэлттэй үйлчилгээний жагсаалт" tabIndex={0}>
        {services.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Одоогоор үйлчилгээний статистик бүртгэгдээгүй байна.
          </p>
        ) : (
          services.map((service, index) => {
            const widthPercent = Math.round((service.count / maxCount) * 100);

            return (
              <div key={service.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 break-words font-bold text-slate-800">
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600">
                      {formatMNT(service.revenue)}
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-sm font-semibold text-slate-700">
                      {service.count} захиалга
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-500"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
