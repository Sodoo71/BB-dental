"use client";
import React from "react";

export default function Info({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-cyan-400">{icon}</span>
      <div>
        <span className="block text-xs text-slate-400">{title}</span>
        <b className="text-sm text-slate-100">{value}</b>
      </div>
    </div>
  );
}
