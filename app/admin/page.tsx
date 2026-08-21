"use client";

import React, { startTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Search,
  RefreshCw,
  Trash2,
  Check,
  X,
} from "lucide-react";

interface Appointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  chiefComplaint?: string;
  patient: {
    fullName: string;
    phone: string;
    age: number | null;
    gender: string | null;
  };
  doctor?: {
    name: string;
  };
  service?: {
    name: string;
    price: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // API-аас цаг захиалгуудыг татах
  const fetchAppointments = async () => {
    try {
      const res = await fetch("/api/admin/appointments");
      if (res.ok) {
        const data = await res.json();
        startTransition(() => setAppointments(data.data || data));
      }
    } catch (error) {
      console.error("Захиалгын дата татахад алдаа гарлаа:", error);
    } finally {
      startTransition(() => setLoading(false));
    }
  };

  useEffect(() => {
    void fetch("/api/auth/me").then((response) => {
      if (!response.ok) router.replace("/login");
      else void fetchAppointments();
    });
  }, [router]);

  // Статус шинэчлэх функц
  const handleStatusChange = async (
    id: string,
    newStatus: Appointment["status"],
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: newStatus } : item,
          ),
        );
      } else {
        alert("Статус өөрчлөхөд алдаа гарлаа.");
      }
    } catch {
      alert("Сервертэй холбогдож чадсангүй.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Цаг захиалга устгах
  const handleDelete = async (id: string) => {
    if (!confirm("Та энэ захиалгыг устгахдаа итгэлтэй байна уу?")) return;

    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAppointments((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert("Устгахад алдаа гарлаа.");
      }
    } catch {
      alert("Сервертэй холбогдож чадсангүй.");
    }
  };

  // Шүүлтүүр хийх (Null/Undefined хамгаалалттай)
  const filteredAppointments = appointments.filter((app) => {
    const matchesStatus = filterStatus === "ALL" || app.status === filterStatus;

    const patientName = app.patient.fullName;
    const patientPhone = app.patient.phone;

    const matchesSearch =
      patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patientPhone.includes(searchQuery);

    return matchesStatus && matchesSearch;
  });

  // Статистик тооцоолол
  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status === "PENDING").length,
    confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
    completed: appointments.filter((a) => a.status === "COMPLETED").length,
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              Эмнэлгийн удирдлагын хэсэг
            </h1>
            <p className="text-sm text-slate-500">
              Цаг захиалга болон эмч нарын хуваарийг хянах
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              void fetchAppointments();
            }}
            className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Шинэчлэх
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Нийт захиалга
            </p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-black text-slate-900">
                {stats.total}
              </span>
              <Users className="w-8 h-8 text-slate-300" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">
              Хүлээгдэж буй
            </p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-black text-amber-600">
                {stats.pending}
              </span>
              <AlertCircle className="w-8 h-8 text-amber-200" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
              Баталгаажсан
            </p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-black text-emerald-600">
                {stats.confirmed}
              </span>
              <CheckCircle2 className="w-8 h-8 text-emerald-200" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">
              Үзлэг дууссан
            </p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-black text-blue-600">
                {stats.completed}
              </span>
              <Clock className="w-8 h-8 text-blue-200" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {[
              { id: "ALL", label: "Бүгд" },
              { id: "PENDING", label: "Хүлээгдэж буй" },
              { id: "CONFIRMED", label: "Баталгаажсан" },
              { id: "COMPLETED", label: "Дууссан" },
              { id: "CANCELLED", label: "Цуцлагдсан" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterStatus === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Нэр эсвэл утсаар хайх..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Өвчтөн</th>
                  <th className="p-4">Огноо & Цаг</th>
                  <th className="p-4">Үйлчилгээ & Эмч</th>
                  <th className="p-4">Зовиур</th>
                  <th className="p-4">Төлөв</th>
                  <th className="p-4 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-slate-400 font-medium"
                    >
                      Цаг захиалга олдсонгүй.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-50/50 transition"
                    >
                      {/* Өвчтөний мэдээлэл */}
                      <td className="p-4">
                        <div className="font-bold text-slate-900">
                          {app.patient.fullName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {app.patient.phone}{" "}
                          {app.patient.age ? `• ${app.patient.age} нас` : ""}
                        </div>
                      </td>

                      {/* Цаг огноо */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {app.appointmentDate
                            ? new Date(app.appointmentDate).toLocaleDateString(
                                "mn-MN",
                              )
                            : "-"}
                        </div>
                        <div className="text-xs text-emerald-600 font-semibold">
                          {app.startTime || "-"}
                        </div>
                      </td>

                      {/* Үйлчилгээ & Эмч */}
                      <td className="p-4">
                        <div className="font-medium text-slate-900">
                          {app.service?.name || "Тодорхойгүй үйлчилгээ"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Эмч: {app.doctor?.name || "Сонгоогүй"}
                        </div>
                      </td>

                      {/* Зовиур */}
                      <td className="p-4 max-w-xs">
                        <p className="text-xs text-slate-600 truncate">
                          {app.chiefComplaint || "-"}
                        </p>
                      </td>

                      {/* Статус */}
                      <td className="p-4 whitespace-nowrap">
                        <StatusBadge status={app.status} />
                      </td>

                      {/* Үйлдлүүд */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          {app.status === "PENDING" && (
                            <button
                              onClick={() =>
                                handleStatusChange(app.id, "CONFIRMED")
                              }
                              disabled={updatingId === app.id}
                              title="Баталгаажуулах"
                              className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          {app.status === "CONFIRMED" && (
                            <button
                              onClick={() =>
                                handleStatusChange(app.id, "COMPLETED")
                              }
                              disabled={updatingId === app.id}
                              title="Үзлэг дууссан гэж тэмдэглэх"
                              className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}

                          {app.status !== "CANCELLED" &&
                            app.status !== "COMPLETED" && (
                              <button
                                onClick={() =>
                                  handleStatusChange(app.id, "CANCELLED")
                                }
                                disabled={updatingId === app.id}
                                title="Цуцлах"
                                className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                          <button
                            onClick={() => handleDelete(app.id)}
                            title="Устгах"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Төлөвийн тэмдэглэгээ (Badge) компонент
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full inline-flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Хүлээгдэж буй
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Баталгаажсан
        </span>
      );
    case "COMPLETED":
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> Дууссан
        </span>
      );
    case "CANCELLED":
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full inline-flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Цуцлагдсан
        </span>
      );
    case "NO_SHOW":
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full inline-flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Ирсэнгүй
        </span>
      );
    default:
      return null;
  }
}
