"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  KeyRound,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
} from "lucide-react";
import Toast from "@/app/components/ui/Toast";
import { useSuperAdminData } from "@/hooks/useSuperAdminData";
import type { ServiceRow } from "@/types/service";
import type { UserRow } from "@/types/user";

export default function SuperAdminPage() {
  const {
    overview,
    doctors,
    users,
    pendingUsers,
    services,
    sessionUserId,
    loading,
    error,
    setUsers,
    setPendingUsers,
    setServices,
  } = useSuperAdminData();

  const [toast, setToast] = useState({ success: false, message: "" });
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "DOCTOR",
    isActive: true,
  });
  const [newPassword, setNewPassword] = useState("");
  const [newServiceForm, setNewServiceForm] = useState({
    name: "",
    description: "",
    durationMin: "30",
    price: "",
    isActive: true,
  });
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [createUserSubmitting, setCreateUserSubmitting] = useState(false);
  const [createServiceSubmitting, setCreateServiceSubmitting] = useState(false);

  const showToast = (success: boolean, message: string) => {
    setToast({ success, message });
  };

  useEffect(() => {
    if (!toast.message) return;
    const timer = window.setTimeout(() => {
      setToast({ success: false, message: "" });
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleApprove = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Approval failed");
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, isActive: true } : user,
        ),
      );
      setPendingUsers((current) =>
        current.filter((user) => user.id !== userId),
      );
      showToast(true, "Хэрэглэгчийг амжилттай баталгаажууллаа.");
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Баталгаажуулахад алдаа гарлаа.",
      );
    }
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setCreateUserSubmitting(true);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserForm.name,
          email: newUserForm.email,
          password: newUserForm.password,
          role: newUserForm.role,
          isActive: newUserForm.isActive,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "User creation failed");
      }

      const createdUser = payload.data as UserRow;
      const normalizedUser = {
        ...createdUser,
        doctorId: createdUser.doctorId ?? null,
        createdAt: createdUser.createdAt || new Date().toISOString(),
      };

      setUsers((current) => [normalizedUser, ...current]);
      if (!normalizedUser.isActive) {
        setPendingUsers((current) => [normalizedUser, ...current]);
      }

      setShowCreateUserModal(false);
      setNewUserForm({
        name: "",
        email: "",
        password: "",
        role: "DOCTOR",
        isActive: true,
      });
      showToast(true, "Хэрэглэгч амжилттай үүслээ.");
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Хэрэглэгч үүсгэхэд алдаа гарлаа.",
      );
    } finally {
      setCreateUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Энэ хэрэглэгчийг устгах уу?")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "User deletion failed");
      }

      setUsers((current) => current.filter((user) => user.id !== userId));
      setPendingUsers((current) =>
        current.filter((user) => user.id !== userId),
      );
      showToast(true, payload.message || "Хэрэглэгч устгагдлаа.");
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Хэрэглэгч устгахад алдаа гарлаа.",
      );
    }
  };

  const handleCreateService = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setCreateServiceSubmitting(true);
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServiceForm.name,
          description: newServiceForm.description,
          durationMin: newServiceForm.durationMin,
          price: newServiceForm.price,
          isActive: newServiceForm.isActive,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Service creation failed");
      }

      const createdService = payload.data as ServiceRow;
      setServices((current) => [createdService, ...current]);
      setShowCreateServiceModal(false);
      setNewServiceForm({
        name: "",
        description: "",
        durationMin: "30",
        price: "",
        isActive: true,
      });
      showToast(true, "Үйлчилгээ амжилттай нэмэгдлээ.");
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Үйлчилгээ нэмэхэд алдаа гарлаа.",
      );
    } finally {
      setCreateServiceSubmitting(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm("Энэ үйлчилгээг устгах уу?")) {
      return;
    }

    try {
      const response = await fetch("/api/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Service deletion failed");
      }

      setServices((current) =>
        current.filter((service) => service.id !== serviceId),
      );
      showToast(true, payload.message || "Үйлчилгээ устгагдлаа.");
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Үйлчилгээ устгахад алдаа гарлаа.",
      );
    }
  };

  const handlePasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;

    try {
      setResetSubmitting(true);
      const response = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, newPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Password reset failed");
      }

      setResetUser(null);
      setNewPassword("");
      showToast(true, payload.message || "Нууц үг шинэчлэгдлээ.");
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Нууц үг солиход алдаа гарлаа.",
      );
    } finally {
      setResetSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-sm">
          Хяналтын самбарыг ачаалж байна…
        </div>
      </main>
    );
  }

  if (error || !overview) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black">
            Хяналтын самбар боломжгүй байна
          </h1>
          <p className="mt-3 text-slate-600">
            {error || "Мэдээлэл олдсонгүй."}
          </p>
        </div>
      </main>
    );
  }

  const metrics = [
    { label: "Нийт эмч нар", value: overview.totalDoctors, icon: Stethoscope },
    {
      label: "Идэвхтэй эмч нар",
      value: overview.activeDoctors,
      icon: ShieldCheck,
    },
    { label: "Нийт өвчтөнүүд", value: overview.totalPatients, icon: Users },
    {
      label: "Өнөөдрийн цаг авалт",
      value: overview.todayAppointments,
      icon: CalendarDays,
    },
    {
      label: "Ирэх цаг авалтууд",
      value: overview.upcomingAppointments,
      icon: Activity,
    },
    {
      label: "Дууссан",
      value: overview.completedAppointments,
      icon: CircleDollarSign,
    },
    {
      label: "Цуцлагдсан",
      value: overview.cancelledAppointments,
      icon: Activity,
    },
    { label: "Ирээгүй", value: overview.noShowAppointments, icon: Activity },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      {toast.message ? <Toast toast={toast} /> : null}

      {resetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  Password reset
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">
                  {resetUser.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="rounded-xl border border-slate-200 px-2 py-1 text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Шинэ нууц үг
                <input
                  required
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                  placeholder="••••••••"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {resetSubmitting ? "Шинэчилж байна..." : "Нууц үг солих"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  New user
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Хэрэглэгч нэмэх
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="rounded-xl border border-slate-200 px-2 py-1 text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                  Нэр
                  <input
                    required
                    value={newUserForm.name}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                    placeholder="Эмч, админ, супер админ"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                  И-мэйл
                  <input
                    required
                    type="email"
                    value={newUserForm.email}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                    placeholder="name@example.com"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                  Нууц үг
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={newUserForm.password}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Эрх
                  <select
                    value={newUserForm.role}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                  >
                    <option value="DOCTOR">DOCTOR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newUserForm.isActive}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Идэвхтэй хэрэглэгч
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={createUserSubmitting}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {createUserSubmitting ? "Үүсгэж байна..." : "Хэрэглэгч нэмэх"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCreateServiceModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  Service
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Үйлчилгээ нэмэх
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateServiceModal(false)}
                className="rounded-xl border border-slate-200 px-2 py-1 text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Нэр
                <input
                  required
                  value={newServiceForm.name}
                  onChange={(event) =>
                    setNewServiceForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                  placeholder="Шүдний эмчилгээ"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Тайлбар
                <textarea
                  value={newServiceForm.description}
                  onChange={(event) =>
                    setNewServiceForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                  placeholder="Товч тайлбар"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Хугацаа (минут)
                  <input
                    required
                    type="number"
                    min="1"
                    value={newServiceForm.durationMin}
                    onChange={(event) =>
                      setNewServiceForm((current) => ({
                        ...current,
                        durationMin: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Үнэ
                  <input
                    required
                    value={newServiceForm.price}
                    onChange={(event) =>
                      setNewServiceForm((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500"
                    placeholder="120000"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={newServiceForm.isActive}
                  onChange={(event) =>
                    setNewServiceForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-emerald-600"
                />
                Идэвхтэй үйлчилгээ
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateServiceModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={createServiceSubmitting}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {createServiceSubmitting
                    ? "Үүсгэж байна..."
                    : "Үйлчилгээ нэмэх"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[28px] bg-slate-950 p-6 text-white shadow-lg shadow-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-400">
                SUPER ADMIN
              </p>
              <h1 className="mt-2 text-3xl font-black">Системийн тойм</h1>
            </div>
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              {[
                "Тойм",
                "Шинжилгээ",
                "Эмч нар",
                "Цаг авалт",
                "Тайлан",
                "Хэрэглэгчид & Эрх",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
                >
                  {item}
                </span>
              ))}
            </nav>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {metric.label}
                </p>
                <metric.icon className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="mt-5 text-3xl font-black text-slate-900">
                {metric.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">
              Баталгаажилт хүлээж буй хэрэглэгчид
            </h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
              {pendingUsers.length} pending
            </span>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Баталгаажилт хүлээж буй хэрэглэгч байхгүй байна.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-900">{user.name}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {user.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(user.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => setResetUser(user)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                    >
                      <KeyRound className="h-4 w-4" />
                      Нууц үг солих
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">
              Хэрэглэгчийн удирдлага
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Нэмэх
              </button>
              <Link
                href="/admin"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
              >
                Админ хяналтын самбар
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-bold">Хэрэглэгч</th>
                  <th className="px-3 py-3 font-bold">Эрх</th>
                  <th className="px-3 py-3 font-bold">Төлөв</th>
                  <th className="px-3 py-3 font-bold">Бүртгүүлсэн</th>
                  <th className="px-3 py-3 font-bold">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 align-middle"
                  >
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-black text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{user.role}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
                      >
                        {user.isActive ? "Идэвхтэй" : "Хүлээгдэж буй"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setResetUser(user)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 font-bold text-white"
                        >
                          <KeyRound className="h-4 w-4" />
                          Нууц үг солих
                        </button>
                        {sessionUserId !== user.id ? (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-bold text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Устгах
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">
              Манай эмнэлгийн үйлчилгээнүүд
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateServiceModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Нэмэх
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-bold">Нэр</th>
                  <th className="px-3 py-3 font-bold">Тайлбар</th>
                  <th className="px-3 py-3 font-bold">Хугацаа</th>
                  <th className="px-3 py-3 font-bold">Үнэ</th>
                  <th className="px-3 py-3 font-bold">Төлөв</th>
                  <th className="px-3 py-3 font-bold">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      Үйлчилгээ байхгүй байна.
                    </td>
                  </tr>
                ) : (
                  services.map((service) => (
                    <tr
                      key={service.id}
                      className="border-b border-slate-100 align-middle"
                    >
                      <td className="px-3 py-3 font-black text-slate-900">
                        {service.name}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {service.description || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {service.durationMin} мин
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {service.price ? `${service.price}₮` : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${service.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
                        >
                          {service.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteService(service.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-bold text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Устгах
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">Эмч нар</h2>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
            >
              Админ хяналтын самбар
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-bold">Эмч</th>
                  <th className="px-3 py-3 font-bold">Мэргэшил</th>
                  <th className="px-3 py-3 font-bold">Төлөв</th>
                  <th className="px-3 py-3 font-bold">Өнөөдөр</th>
                  <th className="px-3 py-3 font-bold">Ирэх</th>
                  <th className="px-3 py-3 font-bold">Дууссан</th>
                  <th className="px-3 py-3 font-bold">Өвчтөнүүд</th>
                  <th className="px-3 py-3 font-bold">Ажиллах өдөр</th>
                  <th className="px-3 py-3 font-bold">Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr
                    key={doctor.id}
                    className="border-b border-slate-100 align-middle"
                  >
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-black text-slate-900">
                          {doctor.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {doctor.email ||
                            doctor.phone ||
                            "Холбоо барих мэдээлэлгүй"}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {doctor.title || "Ерөнхий"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${doctor.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
                      >
                        {doctor.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-700">
                      {doctor.todayAppointments}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-700">
                      {doctor.upcomingAppointments}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-700">
                      {doctor.completedAppointments}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-700">
                      {doctor.patientsBooked}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-700">
                      {doctor.workingDays}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/super-admin/doctors/${doctor.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 font-bold text-white"
                      >
                        Харах <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
