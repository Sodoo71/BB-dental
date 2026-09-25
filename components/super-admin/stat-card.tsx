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
    blue: "bg-brand-100 text-brand-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-brand-100 text-brand-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="dashboard-card flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-slate-500">{title}</p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-brand-700 tabular-nums">
        {value}
      </p>
      {detail ? <p className="mt-2 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
