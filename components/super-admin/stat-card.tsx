import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
  detail,
  icon,
  accent = "slate",
}: {
  title: string;
  value: string;
  detail?: string;
  icon: ReactNode;
  accent?: "slate" | "blue" | "emerald" | "amber" | "violet" | "rose";
}) {
  const accentClasses: Record<typeof accent, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          {icon}
        </div>
      </div>
      {detail ? <p className="mt-4 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
