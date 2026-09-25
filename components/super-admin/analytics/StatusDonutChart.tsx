"use client";

import React from "react";
import { PieChart } from "lucide-react";

interface StatusDonutChartProps {
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export function StatusDonutChart({
  pending,
  confirmed,
  completed,
  cancelled,
  noShow,
}: StatusDonutChartProps) {
  const total = pending + confirmed + completed + cancelled + noShow;

  const items = [
    { label: "Дууссан", count: completed, color: "#0f2c59", bg: "bg-brand-600" },
    {
      label: "Баталгаажсан",
      count: confirmed,
      color: "#10b981",
      bg: "bg-emerald-500",
    },
    {
      label: "Хүлээгдэж буй",
      count: pending,
      color: "#f59e0b",
      bg: "bg-amber-500",
    },
    {
      label: "Цуцлагдсан",
      count: cancelled,
      color: "#ef4444",
      bg: "bg-rose-500",
    },
    { label: "Ирээгүй", count: noShow, color: "#64748b", bg: "bg-slate-500" },
  ];

  // Calculate SVG stroke dashes
  let accumulatedPercent = 0;
  const circumference = 2 * Math.PI * 40; // r = 40 => ~251.32

  const slices = items.map((item) => {
    const percent = total > 0 ? item.count / total : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...item,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="dashboard-card h-full flex flex-col">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <PieChart className="h-4 w-4" />
          </span>
          <h3 className="text-lg font-semibold text-slate-900">
            Захиалгын төлөвийн хуваарилалт
          </h3>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Нийт {total} захиалгын статусын харьцаа
        </p>
      </div>

      <div className="mt-4 flex flex-1 flex-wrap items-center justify-center gap-4">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center">
          <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="12"
            />
            {slices.map((slice) =>
              slice.count > 0 ? (
                <circle
                  key={slice.label}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="12"
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              ) : null,
            )}
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-semibold text-slate-900">{total}</span>
            <span className="text-sm font-semibold text-slate-400">
              Нийт
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2.5 w-full sm:w-auto">
          {slices.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${item.bg}`} />
                <span className="font-semibold text-slate-700">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{item.count}</span>
                <span className="text-sm font-bold text-slate-400">
                  ({item.percent}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
