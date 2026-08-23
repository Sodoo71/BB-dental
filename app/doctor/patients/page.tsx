"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";

type PatientSummary = {
  id: string;
  name: string;
  phone: string;
  totalAppointments: number;
  lastAppointment: string | null;
  nextAppointment: string | null;
};

// Date formatting туслах функц (Hydration & timezone алдаанаас сэргийлнэ)
const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/doctor/overview");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Өвчтөний мэдээллийг ачаалж чадсангүй",
          );
        setPatients(payload.data?.patients || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Өвчтөнүүд
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Миний өвчтөнүүд
          </h1>
        </div>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Хянах самбар
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <span>Өвчтөнүүдийн жагсаалтыг уншиж байна…</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error}
        </div>
      ) : patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Одоогоор танд бүртгэлтэй өвчтөн байхгүй байна.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="p-3">Өвчтөн</th>
                <th className="p-3">Нийт үзлэг</th>
                <th className="p-3">Сүүлийн үзлэг</th>
                <th className="p-3">Дараагийн үзлэг</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {patient.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {patient.phone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">
                    {patient.totalAppointments} удаа
                  </td>
                  <td className="p-3 text-slate-600">
                    {formatDate(patient.lastAppointment)}
                  </td>
                  <td className="p-3 text-slate-600">
                    {formatDate(patient.nextAppointment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
