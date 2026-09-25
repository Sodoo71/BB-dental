"use client";

import React from "react";
import { BarChart3 } from "lucide-react";
import type { DayTrend } from "@/types/dashboard";

interface WeeklyVolumeChartProps {
  data: DayTrend[];
}

export function WeeklyVolumeChart({ data }: WeeklyVolumeChartProps) {
  const maxVolume = Math.max(...data.map((d) => d.total), 5);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Үзлэгийн ачаалал өдрөөр
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Сүүлийн 7 хоногийн өдөр тутмын нийт болон дууссан захиалгууд
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="text-slate-600 font-medium">Нийт</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
            <span className="text-slate-600 font-medium">Дууссан</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 pt-4 pb-2 border-b border-slate-100">
          {data.map((item) => {
            const totalHeight = Math.max(
              Math.round((item.total / maxVolume) * 100),
              item.total > 0 ? 15 : 6,
            );
            const completedHeight =
              item.total > 0
                ? Math.round((item.completed / item.total) * 100)
                : 0;

            return (
              <div
                key={item.date}
                className="group relative flex flex-col items-center h-full justify-end"
              >
                {/* Tooltip */}
                <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 bg-slate-900 text-white text-sm font-bold py-1 px-2 rounded whitespace-nowrap">
                  Нийт: {item.total} | Дууссан: {item.completed}
                </div>

                <div
                  className="w-full max-w-[36px] rounded-xl bg-slate-200 overflow-hidden flex flex-col justify-end transition-all group-hover:brightness-95"
                  style={{ height: `${totalHeight}%` }}
                >
                  <div
                    className="w-full bg-brand-600 rounded-b-xl transition-all"
                    style={{ height: `${completedHeight}%` }}
                  />
                </div>

                <span className="mt-2 text-sm font-bold text-slate-500">
                  {item.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
