"use client";

import { Activity, ArrowRight, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/super-admin/page-header";

const entries = [
  {
    action: "Doctor schedule updated",
    actor: "System Admin",
    time: "Today, 09:42",
  },
  {
    action: "New appointment confirmed",
    actor: "Nurse Desk",
    time: "Today, 08:15",
  },
  {
    action: "Patient profile reviewed",
    actor: "Support Team",
    time: "Yesterday, 16:30",
  },
  {
    action: "Admin access modified",
    actor: "System Admin",
    time: "Yesterday, 14:02",
  },
];

export default function SuperAdminLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Track recent operational changes across the clinic platform."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Recent activity
            </div>
            <div className="text-sm text-slate-500">
              Latest updates from the system
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.time}
              className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium text-slate-800">
                    {entry.action}
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                    {entry.time}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  by {entry.actor}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
