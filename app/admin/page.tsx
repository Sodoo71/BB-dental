"use client";

import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { showToast } from "@/components/ui/Toast";

interface AppointmentNote {
  id: string;
  note: string;
  author?: string | null;
  createdAt: string;
}

interface Appointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  chiefComplaint?: string;
  patient: {
    id: string;
    fullName: string;
    phone: string;
    age: number | null;
    gender: string | null;
  };
  doctor?: { id?: string; name: string };
  service?: { id?: string; name: string; price: number | string };
  notes?: AppointmentNote[];
}

type Doctor = {
  id: string;
  name: string;
  title?: string | null;
  isActive?: boolean;
};

type Service = {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number | string;
  price?: string | number | null;
  imageUrl?: string | null;
  isActive?: boolean;
};

const STATUS_TABS = [
  { id: "ALL", label: "Бүгд" },
  { id: "PENDING", label: "Хүлээгдэж буй" },
  { id: "CONFIRMED", label: "Баталгаажсан" },
  { id: "COMPLETED", label: "Дууссан" },
  { id: "CANCELLED", label: "Цуцлагдсан" },
  { id: "NO_SHOW", label: "Ирсэнгүй" },
] as const;

const toDateInputValue = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const startOfDayTimestamp = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export default function ReceptionDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>("APPOINTMENTS");
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDoctorId, setFilterDoctorId] = useState<string>("ALL");
  const [filterServiceId, setFilterServiceId] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Booking state
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date()),
  );
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [forceBooking, setForceBooking] = useState(false);
  const [customTime, setCustomTime] = useState("10:00");
  const [bookingForm, setBookingForm] = useState({
    patientName: "",
    patientPhone: "",
    startTime: "",
    chiefComplaint: "",
    status: "CONFIRMED",
  });

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringApp, setTransferringApp] = useState<Appointment | null>(null);
  const [targetDoctorId, setTargetDoctorId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Notes drawer state
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activeAppForNotes, setActiveAppForNotes] = useState<Appointment | null>(null);
  const [notesList, setNotesList] = useState<AppointmentNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchDoctors = useCallback(async () => {
    const response = await fetch("/api/doctors");
    const data = await response.json();
    if (!response.ok) return;
    const doctorList = data.data ?? [];
    setDoctors(doctorList);
    if (!selectedDoctorId && doctorList[0]) {
      setSelectedDoctorId(doctorList[0].id);
    }
  }, [selectedDoctorId]);

  const fetchServices = useCallback(async () => {
    const response = await fetch("/api/services?all=true");
    const data = await response.json();
    if (!response.ok) return;
    const serviceList = data.data ?? [];
    setServices(serviceList);
    if (!selectedServiceId && serviceList[0]) {
      setSelectedServiceId(serviceList[0].id);
    }
  }, [selectedServiceId]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/appointments");
      if (!response.ok) return;
      const data = await response.json();
      startTransition(() => setAppointments(data.data || data));
    } catch (error) {
      console.error("Захиалгын дата татахад алдаа гарлаа:", error);
    } finally {
      startTransition(() => setLoading(false));
    }
  }, []);

  const loadAvailableSlots = useCallback(
    async (doctorId: string, serviceId: string, date: string) => {
      if (!doctorId || !serviceId || !date) {
        setAvailableSlots([]);
        return;
      }
      setSlotLoading(true);
      try {
        const response = await fetch(
          `/api/availability?doctorId=${encodeURIComponent(doctorId)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
        );
        const data = await response.json();
        setAvailableSlots(response.ok ? (data.data ?? []) : []);
      } catch {
        setAvailableSlots([]);
      } finally {
        setSlotLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const checkAuth = async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        router.replace("/login");
        return;
      }
      const uData = await response.json();
      setCurrentUser(uData.data);
      await Promise.all([fetchDoctors(), fetchServices(), fetchAppointments()]);
    };

    void checkAuth();
  }, [fetchAppointments, fetchDoctors, fetchServices, router]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedServiceId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }
    void loadAvailableSlots(selectedDoctorId, selectedServiceId, selectedDate);
  }, [loadAvailableSlots, selectedDate, selectedDoctorId, selectedServiceId]);

  const handleBooking = useCallback(async () => {
    const finalStartTime = forceBooking ? customTime : bookingForm.startTime;

    if (!selectedDoctorId || !selectedServiceId || !selectedDate || !finalStartTime) {
      showToast("Эмч, үйлчилгээ, огноо, цагийг бүрэн сонгоно уу.", "error");
      return;
    }
    if (!bookingForm.patientName || !bookingForm.patientPhone) {
      showToast("Өвчтөний нэр болон утас шаардлагатай.", "error");
      return;
    }

    try {
      const response = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          serviceId: selectedServiceId,
          appointmentDate: selectedDate,
          startTime: finalStartTime,
          patientName: bookingForm.patientName,
          patientPhone: bookingForm.patientPhone,
          chiefComplaint: bookingForm.chiefComplaint,
          status: bookingForm.status,
          force: forceBooking,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Захиалгыг үүсгэх боломжгүй байна.");
      }

      setBookingForm({
        patientName: "",
        patientPhone: "",
        startTime: "",
        chiefComplaint: "",
        status: "CONFIRMED",
      });

      await fetchAppointments();
      showToast("Цаг амжилттай захиалагдлаа.", "success");
      setActiveTab("APPOINTMENTS");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Захиалга үүсгэхэд алдаа гарлаа.", "error");
    }
  }, [
    bookingForm,
    customTime,
    fetchAppointments,
    forceBooking,
    selectedDate,
    selectedDoctorId,
    selectedServiceId,
  ]);

  const handleStatusChange = useCallback(
    async (id: string, newStatus: Appointment["status"]) => {
      setUpdatingId(id);
      try {
        const response = await fetch(`/api/admin/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Статус шинэчлэх боломжгүй байна.");

        setAppointments((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: newStatus } : item,
          ),
        );
        showToast("Захиалгын төлөв шинэчлэгдлээ.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Статус шинэчлэхэд алдаа гарлаа.", "error");
      } finally {
        setUpdatingId(null);
      }
    },
    [],
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Энэ захиалгыг устгах уу?")) return;
    try {
      const response = await fetch(`/api/admin/appointments/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Устгах боломжгүй байна.");

      setAppointments((current) => current.filter((item) => item.id !== id));
      showToast("Захиалга устгагдлаа.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Устгахад алдаа гарлаа.", "error");
    }
  }, []);

  // Transfer Appointment
  const handleOpenTransfer = (app: Appointment) => {
    setTransferringApp(app);
    setTargetDoctorId(app.doctor?.id || "");
    setTransferReason("");
    setTransferModalOpen(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferringApp || !targetDoctorId) {
      showToast("Шилжүүлэх эмчийг сонгоно уу.", "error");
      return;
    }

    setTransferring(true);
    try {
      const res = await fetch(`/api/appointments/${transferringApp.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDoctorId,
          reason: transferReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Шилжүүлж чадсангүй.");

      showToast(data.message || "Амжилттай шилжүүллээ.", "success");
      setTransferModalOpen(false);
      await fetchAppointments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setTransferring(false);
    }
  };

  // Notes Modal
  const handleOpenNotes = async (app: Appointment) => {
    setActiveAppForNotes(app);
    setNewNoteText("");
    setNotesModalOpen(true);
    try {
      const res = await fetch(`/api/appointments/${app.id}/notes`);
      const data = await res.json();
      if (res.ok) {
        setNotesList(data.data ?? []);
      }
    } catch {
      setNotesList([]);
    }
  };

  const handleAddNote = async () => {
    if (!activeAppForNotes || !newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/appointments/${activeAppForNotes.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNoteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Тэмдэглэл хадгалж чадсангүй.");

      setNotesList((prev) => [data.data, ...prev]);
      setNewNoteText("");
      showToast("Тэмдэглэл амжилттай хадгалагдлаа.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSavingNote(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const matchesStatus =
        filterStatus === "ALL" || appointment.status === filterStatus;
      const matchesDoctor =
        filterDoctorId === "ALL" || appointment.doctor?.id === filterDoctorId;
      const matchesService =
        filterServiceId === "ALL" ||
        appointment.service?.id === filterServiceId;
      const matchesDate =
        !filterDate ||
        startOfDayTimestamp(appointment.appointmentDate) ===
          startOfDayTimestamp(filterDate);
      const patientName = appointment.patient.fullName ?? "";
      const patientPhone = appointment.patient.phone ?? "";
      const matchesSearch =
        !query ||
        patientName.toLowerCase().includes(query) ||
        patientPhone.includes(searchQuery);

      return (
        matchesStatus &&
        matchesDoctor &&
        matchesService &&
        matchesDate &&
        matchesSearch
      );
    });
  }, [
    appointments,
    filterDate,
    filterDoctorId,
    filterServiceId,
    filterStatus,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return {
      total: appointments.length,
      today: appointments.filter((appointment) => {
        const appointmentTime = new Date(appointment.appointmentDate).getTime();
        return (
          appointmentTime >= todayMs &&
          appointmentTime < todayMs + 24 * 60 * 60 * 1000
        );
      }).length,
      pending: appointments.filter((item) => item.status === "PENDING").length,
      confirmed: appointments.filter((item) => item.status === "CONFIRMED").length,
      completed: appointments.filter((item) => item.status === "COMPLETED").length,
      cancelled: appointments.filter((item) => item.status === "CANCELLED").length,
    };
  }, [appointments]);

  // Distinct patients for directory
  const distinctPatients = useMemo(() => {
    const map = new Map<string, { patient: Appointment["patient"]; count: number; lastDate: string }>();
    for (const a of appointments) {
      const p = a.patient;
      if (!map.has(p.id)) {
        map.set(p.id, { patient: p, count: 1, lastDate: a.appointmentDate });
      } else {
        const item = map.get(p.id)!;
        item.count += 1;
      }
    }
    return Array.from(map.values());
  }, [appointments]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 md:p-6 xl:flex-row">
        {/* Modern Reception Sidebar */}
        <AdminSidebar
          user={
            currentUser || {
              id: "",
              name: "Ресепшн",
              email: "",
              role: "ADMIN",
            }
          }
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />

        {/* Main Content Area */}
        <main className="flex-1 space-y-6">
          {/* Top header bar */}
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                {activeTab === "APPOINTMENTS" && "Өдөр тутмын үзлэгийн цагууд"}
                {activeTab === "QUICK_BOOK" && "Шуурхай цаг бүртгэх"}
                {activeTab === "PATIENTS" && "Үйлчлүүлэгчдийн лавлах"}
              </h1>
              <p className="text-xs text-slate-500">
                Үйлчлүүлэгчдийг хүлээн авах, цаг бүртгэх, эмчид шилжүүлэх ба дотоод тэмдэглэл
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setLoading(true);
                  void fetchAppointments();
                  void fetchDoctors();
                  void fetchServices();
                }}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Шинэчлэх
              </button>
            </div>
          </div>

          {/* TAB 1: APPOINTMENTS */}
          {activeTab === "APPOINTMENTS" && (
            <div className="space-y-6">
              {/* Stats overview */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: "Нийт", value: stats.total, color: "text-slate-900" },
                  { label: "Өнөөдөр", value: stats.today, color: "text-cyan-600" },
                  { label: "Хүлээгдэж буй", value: stats.pending, color: "text-amber-600" },
                  { label: "Баталгаажсан", value: stats.confirmed, color: "text-emerald-600" },
                  { label: "Дууссан", value: stats.completed, color: "text-blue-600" },
                  { label: "Цуцлагдсан", value: stats.cancelled, color: "text-red-600" },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {card.label}
                    </p>
                    <div className={`mt-1.5 text-2xl font-black ${card.color}`}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Table section */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterStatus(tab.id)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          filterStatus === tab.id
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2.5 sm:items-center">
                    <select
                      value={filterDoctorId}
                      onChange={(e) => setFilterDoctorId(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none"
                    >
                      <option value="ALL">Бүх эмч нар</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filterServiceId}
                      onChange={(e) => setFilterServiceId(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none"
                    >
                      <option value="ALL">Бүх үйлчилгээ</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none"
                    />

                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Нэр, утсаар хайх..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="p-4">Үйлчлүүлэгч</th>
                        <th className="p-4">Огноо & Цаг</th>
                        <th className="p-4">Үйлчилгээ</th>
                        <th className="p-4">Хариуцсан эмч</th>
                        <th className="p-4">Төлөв</th>
                        <th className="p-4 text-right">Үйлдлүүд</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-8 text-center text-slate-400"
                          >
                            Захиалга олдсонгүй.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50/60">
                            <td className="p-4">
                              <div className="font-bold text-slate-900">
                                {app.patient.fullName}
                              </div>
                              <div className="text-xs text-slate-500">
                                {app.patient.phone}
                              </div>
                              {app.chiefComplaint && (
                                <div className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                                  Зовиур: {app.chiefComplaint}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-slate-900">
                                {new Date(
                                  app.appointmentDate,
                                ).toLocaleDateString("mn-MN")}
                              </div>
                              <div className="text-xs font-bold text-cyan-600">
                                {app.startTime}
                              </div>
                            </td>
                            <td className="p-4 text-slate-700">
                              {app.service?.name || "-"}
                            </td>
                            <td className="p-4 text-slate-700">
                              <span className="font-semibold text-slate-900">
                                {app.doctor?.name || "Хуваарилаагүй"}
                              </span>
                            </td>
                            <td className="p-4">
                              <StatusBadge status={app.status} />
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Transfer Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenTransfer(app)}
                                  className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-purple-700 transition hover:bg-purple-100"
                                  title="Эмч рүү шилжүүлэх (Transfer)"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </button>

                                {/* Notes Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenNotes(app)}
                                  className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100"
                                  title="Дотоод тэмдэглэл"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </button>

                                {app.status === "PENDING" && (
                                  <button
                                    onClick={() =>
                                      handleStatusChange(app.id, "CONFIRMED")
                                    }
                                    disabled={updatingId === app.id}
                                    className="rounded-xl bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                    title="Баталгаажуулах"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                )}
                                {app.status === "CONFIRMED" && (
                                  <button
                                    onClick={() =>
                                      handleStatusChange(app.id, "COMPLETED")
                                    }
                                    disabled={updatingId === app.id}
                                    className="rounded-xl bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                                    title="Үзлэг дууссан"
                                  >
                                    <Clock className="h-4 w-4" />
                                  </button>
                                )}
                                {app.status !== "CANCELLED" && (
                                  <button
                                    onClick={() =>
                                      handleStatusChange(app.id, "CANCELLED")
                                    }
                                    disabled={updatingId === app.id}
                                    className="rounded-xl bg-amber-50 p-2 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                                    title="Цуцлах"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(app.id)}
                                  disabled={updatingId === app.id}
                                  className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                  title="Устгах"
                                >
                                  <Trash2 className="h-4 w-4" />
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
          )}

          {/* TAB 2: QUICK BOOK */}
          {activeTab === "QUICK_BOOK" && (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      Шуурхай цаг захиалах
                    </h2>
                    <p className="text-xs text-slate-500">
                      Утсаар эсвэл биеэр ирсэн үйлчлүүлэгчид цаг товлох
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={forceBooking}
                      onChange={(e) => setForceBooking(e.target.checked)}
                      className="h-4 w-4 rounded text-cyan-600"
                    />
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>Тусгай цаг оноох</span>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs font-bold text-slate-700">
                    <span>Эмч сонгох *</span>
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    >
                      <option value="">Сонгох</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.name} {doctor.title ? `(${doctor.title})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-slate-700">
                    <span>Үйлчилгээ сонгох *</span>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    >
                      <option value="">Сонгох</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.durationMin} мин)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-slate-700">
                    <span>Огноо *</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-slate-700">
                    <span>Эхлэх төлөв</span>
                    <select
                      value={bookingForm.status}
                      onChange={(e) =>
                        setBookingForm((current) => ({
                          ...current,
                          status: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    >
                      <option value="CONFIRMED">Баталгаажсан (Шууд товлох)</option>
                      <option value="PENDING">Хүлээгдэж буй</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-slate-700 sm:col-span-2">
                    <span>Өвчтөний бүтэн нэр *</span>
                    <input
                      value={bookingForm.patientName}
                      onChange={(e) =>
                        setBookingForm((current) => ({
                          ...current,
                          patientName: e.target.value,
                        }))
                      }
                      placeholder="Өвчтөний нэр"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-slate-700 sm:col-span-2">
                    <span>Утасны дугаар *</span>
                    <input
                      value={bookingForm.patientPhone}
                      onChange={(e) =>
                        setBookingForm((current) => ({
                          ...current,
                          patientPhone: e.target.value,
                        }))
                      }
                      placeholder="9911xxxx"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-slate-700 sm:col-span-2">
                    <span>Зовиур / Тэмдэглэл</span>
                    <textarea
                      value={bookingForm.chiefComplaint}
                      onChange={(e) =>
                        setBookingForm((current) => ({
                          ...current,
                          chiefComplaint: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Шүд өвдөж байгаа эсвэл зовиур"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                    />
                  </label>
                </div>

                {/* Slot selection */}
                <div className="mt-5">
                  {forceBooking ? (
                    <label className="block text-xs font-bold text-slate-700">
                      Хүссэн цагаа шууд оруулна уу:
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-base font-bold outline-none"
                      />
                    </label>
                  ) : (
                    <div>
                      <span className="mb-2 block text-xs font-bold text-slate-700">
                        Боломжит цагууд:
                      </span>
                      {slotLoading ? (
                        <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                          <span>Цагуудыг шалгаж байна...</span>
                        </div>
                      ) : availableSlots.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() =>
                                setBookingForm((current) => ({
                                  ...current,
                                  startTime: slot,
                                }))
                              }
                              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                                bookingForm.startTime === slot
                                  ? "border-cyan-600 bg-cyan-600 text-white shadow-sm"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-400 hover:bg-cyan-50"
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                          Энэ өдөр ердийн боломжит цаг олдсонгүй. &quot;Тусгай цаг оноох&quot; сонголтоор цаг оруулж болно.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleBooking}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-slate-800"
                >
                  <PlusCircle className="h-4 w-4" />
                  Захиалга баталгаажуулах
                </button>
              </div>

              {/* Side Summary */}
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-lg">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                  Захиалгын мэдээлэл
                </p>
                <h3 className="mt-1 text-lg font-black">
                  {selectedDoctorId
                    ? doctors.find((d) => d.id === selectedDoctorId)?.name
                    : "Эмч сонгоогүй"}
                </h3>

                <div className="mt-6 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-slate-400">Үйлчилгээ</span>
                    <span className="font-bold text-white">
                      {services.find((s) => s.id === selectedServiceId)?.name ||
                        "Сонгоогүй"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-slate-400">Огноо</span>
                    <span className="font-bold text-white">{selectedDate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-slate-400">Цаг</span>
                    <span className="font-bold text-cyan-400">
                      {forceBooking
                        ? customTime
                        : bookingForm.startTime || "Сонгоогүй"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PATIENTS DIRECTORY */}
          {activeTab === "PATIENTS" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Үйлчлүүлэгчдийн лавлах сан
                  </h2>
                  <p className="text-xs text-slate-500">
                    Бүртгэлтэй нийт өвчтөнүүд болон тэдний үзлэгийн тоо
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {distinctPatients.map(({ patient, count, lastDate }) => (
                  <div
                    key={patient.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 font-bold">
                        {patient.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {patient.fullName}
                        </h4>
                        <p className="text-xs text-slate-500">{patient.phone}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 text-xs text-slate-600">
                      <span>Үзүүлсэн тоо: <strong>{count} удаа</strong></span>
                      <span>Сүүлд: {new Date(lastDate).toLocaleDateString("mn-MN")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Transfer Appointment Modal */}
      {transferModalOpen && transferringApp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  Өвчтөн шилжүүлэх
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {transferringApp.patient.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-purple-50 p-3.5 text-xs text-purple-950">
              <p>
                Одоогийн эмч: <strong>{transferringApp.doctor?.name || "Байхгүй"}</strong>
              </p>
              <p className="mt-1 text-slate-600">
                Огноо: {new Date(transferringApp.appointmentDate).toLocaleDateString("mn-MN")} {transferringApp.startTime}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1 font-bold text-slate-700">
                <span>Шилжүүлэн авах эмч *</span>
                <select
                  value={targetDoctorId}
                  onChange={(e) => setTargetDoctorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                >
                  <option value="">Эмч сонгох</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.title ? `(${d.title})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Шилжүүлэх шалтгаан / Тэмдэглэл</span>
                <textarea
                  rows={2}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Жишээ: Гажиг заслын нарийн мэргэжлийн үзлэг шаардлагатай..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Цуцлах
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={transferring}
                className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-purple-500 disabled:opacity-50"
              >
                {transferring ? "Шилжүүлж байна..." : "Шилжүүлэх"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Notes Modal */}
      {notesModalOpen && activeAppForNotes && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Дотоод тэмдэглэл
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {activeAppForNotes.patient.fullName} · {activeAppForNotes.patient.phone}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Note Input */}
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Шинэ тэмдэглэл бичих (ж: 15 минутын дараа залгах, харшилтай)..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-blue-400 focus:bg-white"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={savingNote || !newNoteText.trim()}
                className="flex items-center justify-center rounded-2xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            {/* Notes List */}
            <div className="max-h-60 overflow-y-auto space-y-2.5 pt-2">
              {notesList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                  Одоогоор бичигдсэн тэмдэглэл байхгүй байна.
                </div>
              ) : (
                notesList.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <p className="text-slate-800 leading-relaxed font-medium">
                      {n.note}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{n.author || "Ажилтан"}</span>
                      <span>
                        {new Date(n.createdAt).toLocaleString("mn-MN")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <AlertCircle className="h-3 w-3" /> Хүлээгдэж буй
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Баталгаажсан
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          <Clock className="h-3 w-3" /> Дууссан
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <XCircle className="h-3 w-3" /> Цуцлагдсан
        </span>
      );
    case "NO_SHOW":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <Users className="h-3 w-3" /> Ирсэнгүй
        </span>
      );
    default:
      return null;
  }
}
