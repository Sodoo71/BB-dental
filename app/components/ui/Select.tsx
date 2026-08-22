"use client";
import React from "react";

export default function Select({
  icon,
  label,
  value,
  change,
  options,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: (x: string) => void;
  options: string[][];
  loading: boolean;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 p-3.5 text-sm transition focus-within:border-cyan-600">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-cyan-600">
        {icon}
        {label}
      </span>
      <select
        disabled={loading}
        value={value}
        onChange={(e) => change(e.target.value)}
        className="w-full bg-transparent font-bold outline-none text-slate-800"
      >
        <option value="">Сонгох</option>
        {options.map(([v, l]) => (
          <option value={v} key={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
