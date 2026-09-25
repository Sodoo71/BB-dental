"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import type { DayTrend } from "@/types/dashboard";

interface RevenueChartProps {
  data: DayTrend[];
  totalRevenue: number;
  todayRevenue: number;
}

export function RevenueChart({
  data,
  totalRevenue,
  todayRevenue,
}: RevenueChartProps) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100000);

  const formatMNT = (amount: number) => {
    return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
  };

  return (
    <div className="dashboard-card h-full">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-semibold text-slate-900">
              Орлогын динамик (Сүүлийн 7 хоног)
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Өдөр бүрийн дууссан үзлэгүүдийн бодит орлогын хэмжээ
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-slate-400">
              Өнөөдрийн орлого
            </span>
            <p className="break-words text-2xl font-semibold text-emerald-600">
              {formatMNT(todayRevenue)}
            </p>
          </div>
          <div className="min-w-0 border-l border-slate-200 pl-4">
            <span className="text-sm font-semibold text-slate-400">
              Нийт хуримтлагдсан
            </span>
            <p className="break-words text-2xl font-semibold text-slate-900">
              {formatMNT(totalRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="mt-4">
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-32 pt-4 pb-2 border-b border-slate-100">
          {data.map((item, idx) => {
            const heightPercent = Math.max(
              Math.round((item.revenue / maxRevenue) * 100),
              item.revenue > 0 ? 12 : 4,
            );
            const isToday = idx === data.length - 1;

            return (
              <div
                key={item.date}
                className="group relative flex flex-col items-center h-full justify-end"
              >
                {/* Tooltip on hover */}
                <div className={`absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 bg-slate-950 text-white text-sm font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg ${idx < 2 ? "left-0" : idx >= data.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                  {formatMNT(item.revenue)} ({item.completed} үзлэг)
                </div>

                {/* Bar */}
                <div className="flex min-h-0 w-full flex-1 items-end justify-center">
                  <div
                    className={`w-full max-w-[42px] rounded-lg transition-all duration-500 group-hover:brightness-110 ${
                      isToday
                        ? "bg-brand-700"
                        : item.revenue > 0
                          ? "bg-brand-400"
                          : "bg-slate-100"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>

                <span className="mt-2 text-sm font-bold text-slate-500 group-hover:text-slate-900">
                  {item.dayName}
                </span>
                <span className="whitespace-nowrap text-sm text-slate-400">
                  {item.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
