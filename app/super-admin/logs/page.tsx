"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarCheck2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/super-admin/page-header";

type LogEntry = {
  id: string;
  action: string;
  category: "APPOINTMENT" | "USER" | "DOCTOR" | "SYSTEM";
  actor: string;
  details: string;
  time: string;
  badge: string;
  badgeColor: string;
};

export default function SuperAdminLogsPage() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/logs?page=${page}&category=${filter}&search=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Лог ачаалж чадсангүй.");
      setError("");
      setTotal(json.pagination.total);
      if (json.data) {
        setLogs(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Лог ачаалж чадсангүй.");
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadLogs(); }, 250);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  const filtered = logs;

  const formatLogTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("mn-MN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Системийн үйл ажиллагааны лог"
        description="Цаг захиалга, баталгаажуулалт, ажилтнуудын бүртгэл болон системийн өөрчлөлтүүдийг цаг тухайд нь хянах."
        action={
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Шинэчлэх</span>
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "ALL", label: "Бүх үйлдлүүд" },
            { id: "APPOINTMENT", label: "Үзлэгийн цаг" },
            { id: "USER", label: "Хэрэглэгч" },
            { id: "DOCTOR", label: "Эмч нар" },
            { id: "SYSTEM", label: "Систем" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setPage(1); setFilter(tab.id); }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filter === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Хайх (үйлдэл, нэр, утас)..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white sm:w-64"
          />
        </div>
      </div>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex items-center gap-4"><button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Өмнөх</button><span>{page} / {Math.max(1, Math.ceil(total / 50))} · {total} лог</span><button disabled={page * 50 >= total || loading} onClick={() => setPage(p => p + 1)}>Дараах</button></div>
      {/* Log Feed */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                Сүүлийн үйлдлүүдийн жагсаалт
              </h3>
              <p className="text-xs text-slate-500">
                Нийт {filtered.length} лог бүртгэл харагдаж байна
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">
            Одоогоор ямар нэгэн лог бичлэг олдсонгүй.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="flex min-w-0 flex-col items-start justify-between gap-3 rounded-2xl sm:flex-row sm:gap-4 border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-100/70"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                    {entry.category === "APPOINTMENT" && (
                      <CalendarCheck2 className="h-4 w-4 text-brand-600" />
                    )}
                    {entry.category === "USER" && (
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                    )}
                    {entry.category === "DOCTOR" && (
                      <Stethoscope className="h-4 w-4 text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {entry.action}
                      </span>
                      <span
                        className={`max-w-full break-all rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${entry.badgeColor}`}
                      >
                        {entry.badge}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-600 font-medium">
                      {entry.details}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-slate-500">
                      Хийсэн:{" "}
                      <span className="font-semibold text-slate-600">
                        {entry.actor}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 shrink-0">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatLogTime(entry.time)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
