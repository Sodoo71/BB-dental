"use client";
import React from "react";

export default function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block text-sm font-bold text-slate-700">
      {label}
      <span className="mt-1 block [&_input]:w-full [&_input]:rounded-2xl [&_input]:border [&_input]:border-slate-200 [&_input]:p-3 [&_input]:outline-none [&_input]:transition [&_input]:focus:border-cyan-600 [&_select]:w-full [&_select]:rounded-2xl [&_select]:border [&_select]:border-slate-200 [&_select]:p-3 [&_select]:outline-none [&_textarea]:w-full [&_textarea]:rounded-2xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:p-3 [&_textarea]:outline-none">
        {children}
      </span>
    </label>
  );
}
