import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="page-title">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
