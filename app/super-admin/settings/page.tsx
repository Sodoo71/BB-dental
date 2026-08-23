"use client";

import { Bell, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/super-admin/page-header";

const settings = [
  {
    label: "Notifications",
    description: "Email and in-app reminders",
    enabled: true,
    icon: Bell,
  },
  {
    label: "Access control",
    description: "Require dual confirmation for admin actions",
    enabled: true,
    icon: ShieldCheck,
  },
  {
    label: "Advanced preferences",
    description: "Enable system-level automation",
    enabled: false,
    icon: SlidersHorizontal,
  },
];

export default function SuperAdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage system preferences and operational controls."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {settings.map(({ label, description, enabled, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{label}</div>
                  <div className="text-sm text-slate-500">{description}</div>
                </div>
              </div>
              <button
                type="button"
                className={[
                  "relative h-6 w-11 rounded-full transition",
                  enabled ? "bg-slate-900" : "bg-slate-200",
                ].join(" ")}
                aria-label={`Toggle ${label}`}
              >
                <span
                  className={[
                    "absolute top-1 h-4 w-4 rounded-full bg-white transition",
                    enabled ? "left-6" : "left-1",
                  ].join(" ")}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold">System health</div>
            <div className="text-sm text-slate-300">
              All core services running normally.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
