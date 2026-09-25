"use client";

import Link from "next/link";
import {
  Activity,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useSuperAdminData } from "@/hooks/useSuperAdminData";
import { PageHeader } from "@/components/super-admin/page-header";
import { StatCard } from "@/components/super-admin/stat-card";
import { RevenueChart } from "@/components/super-admin/analytics/RevenueChart";
import { StatusDonutChart } from "@/components/super-admin/analytics/StatusDonutChart";
import { TopServicesCard } from "@/components/super-admin/analytics/TopServicesCard";
import { DoctorWorkloadCard } from "@/components/super-admin/analytics/DoctorWorkloadCard";
import { approveUser, deleteUser } from "@/lib/api/super-admin";
import { getRoleLabel } from "@/lib/roles";
import { showToast } from "@/components/ui/Toast";

export default function SuperAdminPage() {
  const { overview, doctors, users, pendingUsers, loading, error, refresh } =
    useSuperAdminData();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleApprove = async (userId: string, name: string) => {
    setProcessingId(userId);
    setActionMessage(null);
    try {
      await approveUser(userId);
      setActionMessage(`${name} хэрэглэгчийн хүсэлт баталгаажлаа.`);
      showToast(`${name} хэрэглэгчийн бүртгэл баталгаажлаа.`, "success");
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Баталгаажуулахад алдаа гарлаа.";
      setActionMessage(msg);
      showToast(msg, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string, name: string) => {
    if (!confirm(`${name} хэрэглэгчийн хүсэлтийг татгалзаж устгах уу?`)) return;

    setProcessingId(userId);
    setActionMessage(null);
    try {
      await deleteUser(userId);
      setActionMessage(`${name} хэрэглэгчийн хүсэлт цуцлагдлаа.`);
      showToast(`${name} хэрэглэгчийн хүсэлтийг цуцаллаа.`, "success");
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Устгахад алдаа гарлаа.";
      showToast(msg, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const formatMNT = (amount: number) => {
    return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
  };

  const stats = [
    {
      title: "Нийт эмч нар",
      value: String(overview?.totalDoctors ?? doctors.length),
      detail: `${overview?.activeDoctors ?? doctors.filter((d) => d.isActive).length} идэвхтэй эмч`,
      icon: <Stethoscope className="h-5 w-5" />,
      accent: "blue" as const,
    },
    {
      title: "Шинэ хүсэлтүүд",
      value: String(overview?.pendingUsers ?? pendingUsers.length),
      detail: `${overview?.pendingUsers ?? pendingUsers.length} хэрэглэгч зөвшөөрөл хүлээж байна`,
      icon: <UserPlus className="h-5 w-5" />,
      accent: ((overview?.pendingUsers ?? pendingUsers.length) > 0
        ? "amber"
        : "emerald") as any,
    },
    {
      title: "Өнөөдрийн захиалга",
      value: String(overview?.todayAppointments ?? 0),
      detail: `${overview?.upcomingAppointments ?? 0} удахгүй болох`,
      icon: <CalendarCheck2 className="h-5 w-5" />,
      accent: "emerald" as const,
    },
    {
      title: "Хуримтлагдсан орлого",
      value: formatMNT(overview?.totalCompletedRevenue ?? 0),
      detail: `Өнөөдөр: ${formatMNT(overview?.todayEstimatedRevenue ?? 0)}`,
      icon: <CreditCard className="h-5 w-5" />,
      accent: "violet" as const,
    },
  ];

  const topDoctors = doctors.slice(0, 4);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Хянах самбар"
        description="Системийн хяналт болон клиникийн нэгдсэн статистик."
        action={
          <Link
            href="/super-admin/doctors"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Activity className="h-4 w-4" />
            Эмч нарын жагсаалт
          </Link>
        }
      />

      {actionMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
          <button aria-label="Хаах"
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            detail={stat.detail}
            icon={stat.icon}
            accent={stat.accent}
          />
        ))}
      </div>

      {/* VISUAL ANALYTICS SECTION */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <RevenueChart
            data={overview?.weeklyTrend || []}
            totalRevenue={overview?.totalCompletedRevenue || 0}
            todayRevenue={overview?.todayEstimatedRevenue || 0}
          />
        </div>
        <div className="min-w-0">
          <StatusDonutChart
            pending={overview?.pendingAppointments || 0}
            confirmed={overview?.confirmedAppointments || 0}
            completed={overview?.completedAppointments || 0}
            cancelled={overview?.cancelledAppointments || 0}
            noShow={overview?.noShowAppointments || 0}
          />
        </div>
      </div>

      {/* OPERATIONS & SERVICES BREAKDOWN */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <TopServicesCard services={overview?.topServices || []} />
        </div>
        <div className="min-w-0">
          <DoctorWorkloadCard doctors={overview?.doctorWorkload || []} />
        </div>
      </div>
      <div className="dashboard-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Шинэ бүртгэлийн хүсэлтүүд
              </h2>
              <p className="text-sm text-slate-500">
                Зөвшөөрөл хүлээгдэж буй шинэ аккаунтууд
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
            {pendingUsers.length} хүсэлт
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-slate-500">
            Хүсэлтүүдийг ачаалж байна...
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Хүлээгдэж буй шинэ бүртгэлийн хүсэлт байхгүй байна. Бүх бүртгэл
            баталгаажсан.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Мэдээллийн хүснэгт"><table className="w-full min-w-[1100px] table-fixed text-left text-sm [&_th]:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                <tr>
                  <th className="w-[23%] px-3 py-3">Хэрэглэгч</th>
                  <th className="w-[25%] px-3 py-3">И-мэйл</th>
                  <th className="w-[18%] px-3 py-3">Хүссэн эрх</th>
                  <th className="w-[15%] px-3 py-3">Огноо</th>
                  <th className="w-[19%] px-3 py-3 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td className="truncate px-3 py-3 text-slate-600">
                      {user.email}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700">
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-500">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("mn-MN")
                        : "-"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(user.id, user.name)}
                          disabled={processingId === user.id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {processingId === user.id
                            ? "Түр хүлээнэ үү..."
                            : "Зөвшөөрөх"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(user.id, user.name)}
                          disabled={processingId === user.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Татгалзах
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="dashboard-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Эмч нарын ажлын тойм
              </h2>
              <p className="text-sm text-slate-500">
                Идэвхтэй эмч нарын өнөөдрийн ачаалал
              </p>
            </div>
            <Link
              href="/super-admin/doctors"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Бүгдийг харах
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Ачаалж байна...</div>
          ) : (
            <div className="space-y-2">
              {topDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {doctor.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        {doctor.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {doctor.title ?? "Doctor"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-800">
                      {doctor.todayAppointments ?? 0}
                    </div>
                    <div className="text-sm text-slate-500">өнөөдөр</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Системийн төлөв ба Нэгтгэл
              </h2>
              <p className="text-sm text-slate-500">
                Өгөгдлийн сангийн бодит мэдээлэл
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Нийт үзлэг/захиалга
              </span>
              <span className="text-sm font-bold text-slate-900">
                {overview?.totalAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Бүртгэлтэй өвчтөнүүд
              </span>
              <span className="text-sm font-bold text-slate-900">
                {overview?.totalPatients ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Үзүүлж дууссан захиалга
              </span>
              <span className="text-sm font-bold text-emerald-700">
                {overview?.completedAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Баталгаажсан захиалга
              </span>
              <span className="text-sm font-bold text-brand-700">
                {overview?.confirmedAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Цуцлагдсан</span>
              <span className="text-sm font-bold text-red-600">
                {overview?.cancelledAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Идэвхтэй үйлчилгээнүүд
              </span>
              <span className="text-sm font-bold text-slate-900">
                {overview?.servicesCount ?? 0} төрөл
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">
                Өнөөдөр ажиллах эмч нар
              </span>
              <span className="text-sm font-bold text-slate-900">
                {overview?.doctorsWorkingToday ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
