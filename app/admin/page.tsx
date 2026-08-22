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
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
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
  doctor?: { name: string };
  service?: { id?: string; name: string; price: number | string };
}

type ScheduleRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
};

type Doctor = {
  id: string;
  name: string;
  title?: string | null;
  isActive?: boolean;
};
type Service = {
  id: string;
  name: string;
  durationMin: number | string;
  price?: string | number | null;
};

const weekdayLabels = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
const defaultWeek: ScheduleRow[] = Array.from(
  { length: 7 },
  (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
    isDayOff: false,
  }),
);

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

const normalizeSchedule = (rows: Array<Partial<ScheduleRow>> = []) =>
  defaultWeek.map((slot) => {
    const existing = rows.find((row) => row.dayOfWeek === slot.dayOfWeek);

    if (!existing) return slot;

    const isDayOff = Boolean(existing.isDayOff);

    return {
      dayOfWeek: slot.dayOfWeek,
      startTime: isDayOff ? "09:00" : existing.startTime || slot.startTime,
      endTime: isDayOff ? "17:00" : existing.endTime || slot.endTime,
      isDayOff,
    };
  });

export default function AdminDashboard() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterServiceId, setFilterServiceId] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date()),
  );
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patientName: "",
    patientPhone: "",
    startTime: "",
    chiefComplaint: "",
    status: "PENDING",
  });
  const [schedule, setSchedule] = useState<ScheduleRow[]>(defaultWeek);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const setBookingField = useCallback((patch: Partial<typeof bookingForm>) => {
    setBookingForm((current) => ({ ...current, ...patch }));
  }, []);

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
    const response = await fetch("/api/services");
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

  const loadSchedule = useCallback(async (doctorId: string) => {
    if (!doctorId) return;

    const response = await fetch(`/api/admin/doctors/${doctorId}/schedule`);
    if (!response.ok) return;

    const data = await response.json();
    setSchedule(normalizeSchedule(data.data ?? defaultWeek));
  }, []);

  const saveSchedule = useCallback(async () => {
    if (!selectedDoctorId) return;

    setSavingSchedule(true);

    try {
      const response = await fetch(
        `/api/admin/doctors/${selectedDoctorId}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(schedule),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Хуваарь хадгалах боломжгүй байна.");
      }

      alert("Хуваарь амжилттай хадгалагдлаа.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Хуваарь хадгалах үед алдаа гарлаа.",
      );
    } finally {
      setSavingSchedule(false);
    }
  }, [schedule, selectedDoctorId]);

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

  const handleBooking = useCallback(async () => {
    if (
      !selectedDoctorId ||
      !selectedServiceId ||
      !selectedDate ||
      !bookingForm.startTime
    ) {
      alert("Эмч, үйлчилгээ, огноо, цагийг бүрэн сонгоно уу.");
      return;
    }

    if (!bookingForm.patientName || !bookingForm.patientPhone) {
      alert("Өвчтөний нэр болон утас шаардлагатай.");
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
          startTime: bookingForm.startTime,
          patientName: bookingForm.patientName,
          patientPhone: bookingForm.patientPhone,
          chiefComplaint: bookingForm.chiefComplaint,
          status: bookingForm.status,
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
        status: "PENDING",
      });

      await fetchAppointments();
      await loadAvailableSlots(
        selectedDoctorId,
        selectedServiceId,
        selectedDate,
      );
      alert("Цаг амжилттай захиалагдлаа.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Захиалга үүсгэхэд алдаа гарлаа.",
      );
    }
  }, [
    bookingForm,
    fetchAppointments,
    loadAvailableSlots,
    selectedDate,
    selectedDoctorId,
    selectedServiceId,
  ]);

  const bookNextAvailable = useCallback(async () => {
    if (!selectedDoctorId || !selectedServiceId) {
      alert("Эмч болон үйлчилгээ сонгоно уу.");
      return;
    }

    const today = new Date();

    for (let offset = 0; offset <= 90; offset += 1) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + offset);
      const isoDate = toDateInputValue(date);
      const response = await fetch(
        `/api/availability?doctorId=${encodeURIComponent(selectedDoctorId)}&serviceId=${encodeURIComponent(selectedServiceId)}&date=${encodeURIComponent(isoDate)}`,
      );
      const result = await response.json();

      if (response.ok && Array.isArray(result.data) && result.data.length > 0) {
        setSelectedDate(isoDate);
        setBookingField({ startTime: result.data[0] });
        await loadAvailableSlots(selectedDoctorId, selectedServiceId, isoDate);
        return;
      }
    }

    alert("Энэ эмчийн ойрын 90 хоногт боломжит цаг олдсонгүй.");
  }, [
    loadAvailableSlots,
    selectedDoctorId,
    selectedServiceId,
    setBookingField,
  ]);

  useEffect(() => {
    const checkAuth = async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        router.replace("/login");
        return;
      }

      await Promise.all([fetchDoctors(), fetchServices(), fetchAppointments()]);
    };

    void checkAuth();
  }, [fetchAppointments, fetchDoctors, fetchServices, router]);

  useEffect(() => {
    if (!selectedDoctorId) return;

    const timer = setTimeout(() => {
      void loadSchedule(selectedDoctorId);
    }, 0);

    return () => clearTimeout(timer);
  }, [loadSchedule, selectedDoctorId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedDoctorId || !selectedServiceId || !selectedDate) {
        setAvailableSlots([]);
        return;
      }

      void loadAvailableSlots(
        selectedDoctorId,
        selectedServiceId,
        selectedDate,
      );
    }, 0);

    return () => clearTimeout(timer);
  }, [loadAvailableSlots, selectedDoctorId, selectedDate, selectedServiceId]);

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const matchesStatus =
        filterStatus === "ALL" || appointment.status === filterStatus;
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

      return matchesStatus && matchesService && matchesDate && matchesSearch;
    });
  }, [appointments, filterDate, filterServiceId, filterStatus, searchQuery]);

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
      confirmed: appointments.filter((item) => item.status === "CONFIRMED")
        .length,
      completed: appointments.filter((item) => item.status === "COMPLETED")
        .length,
      cancelled: appointments.filter((item) => item.status === "CANCELLED")
        .length,
      upcoming: appointments.filter(
        (item) => new Date(item.appointmentDate).getTime() >= todayMs,
      ).length,
    };
  }, [appointments]);

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
        if (!response.ok) {
          throw new Error(data.error || "Статус шинэчлэх боломжгүй байна.");
        }

        setAppointments((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: newStatus } : item,
          ),
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Статус шинэчлэхэд алдаа гарлаа.",
        );
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

      if (!response.ok) {
        throw new Error(data.error || "Устгах боломжгүй байна.");
      }

      setAppointments((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Устгахад алдаа гарлаа.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">
              Эмнэлгийн удирдлагын хэсэг
            </h1>
            <p className="text-sm text-slate-500">
              Эмч, цаг, захиалга, хуваарь
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              void fetchAppointments();
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Шинэчлэх
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {[
            { label: "Нийт", value: stats.total, color: "text-slate-900" },
            { label: "Өнөөдөр", value: stats.today, color: "text-cyan-600" },
            {
              label: "Удахгүй",
              value: stats.upcoming,
              color: "text-emerald-600",
            },
            {
              label: "Хүлээгдэж буй",
              value: stats.pending,
              color: "text-amber-600",
            },
            {
              label: "Баталгаажсан",
              value: stats.confirmed,
              color: "text-emerald-600",
            },
            {
              label: "Цуцлагдсан",
              value: stats.cancelled,
              color: "text-red-600",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {card.label}
              </p>
              <div className={`mt-2 text-2xl font-black ${card.color}`}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
                  Quick booking
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  Шуурхай захиалга
                </h2>
              </div>
              <button
                onClick={bookNextAvailable}
                className="rounded-xl bg-cyan-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm shadow-cyan-200 transition hover:bg-cyan-500"
              >
                Дараагийн боломжит цаг
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-600">
                <span>Эмч</span>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Сонгох</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-600">
                <span>Үйлчилгээ</span>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Сонгох</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-600">
                <span>Огноо</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-600">
                <span>Төлөв</span>
                <select
                  value={bookingForm.status}
                  onChange={(e) =>
                    setBookingForm((current) => ({
                      ...current,
                      status: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="PENDING">Хүлээгдэж буй</option>
                  <option value="CONFIRMED">Баталгаажсан</option>
                  <option value="COMPLETED">Дууссан</option>
                  <option value="NO_SHOW">Ирсэнгүй</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-600 sm:col-span-2">
                <span>Өвчтөний нэр</span>
                <input
                  value={bookingForm.patientName}
                  onChange={(e) =>
                    setBookingForm((current) => ({
                      ...current,
                      patientName: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                  placeholder="Нэр"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-600 sm:col-span-2">
                <span>Утас</span>
                <input
                  value={bookingForm.patientPhone}
                  onChange={(e) =>
                    setBookingForm((current) => ({
                      ...current,
                      patientPhone: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                  placeholder="9911xxxx"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-600 sm:col-span-2">
                <span>Зовиур</span>
                <textarea
                  value={bookingForm.chiefComplaint}
                  onChange={(e) =>
                    setBookingForm((current) => ({
                      ...current,
                      chiefComplaint: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                  rows={3}
                  placeholder="Товч тайлбар"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-sm font-bold text-slate-700">
                  Боломжит цаг
                </strong>
                {slotLoading && (
                  <span className="text-xs text-slate-500">
                    Ачааллаж байна…
                  </span>
                )}
              </div>
              {availableSlots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() =>
                        setBookingForm((current) => ({
                          ...current,
                          startTime: slot,
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${bookingForm.startTime === slot ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50"}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Энэ өдөр боломжит цаг байхгүй байна.
                </p>
              )}
            </div>

            <button
              onClick={handleBooking}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white transition hover:bg-emerald-500"
            >
              Захиалга үүсгэх
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
                  Weekly schedule
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  Эмчийн хуваарь
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                {selectedDoctorId ? "Live" : "Select doctor"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {schedule.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className={`rounded-2xl border p-3 transition ${
                    day.isDayOff
                      ? "border-slate-200 bg-slate-50"
                      : "border-cyan-100 bg-cyan-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-800">
                      {weekdayLabels[day.dayOfWeek]}
                    </span>
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={day.isDayOff}
                        onChange={(e) => {
                          const isDayOff = e.target.checked;
                          setSchedule((current) =>
                            current.map((row) => {
                              if (row.dayOfWeek !== day.dayOfWeek) return row;

                              return {
                                ...row,
                                isDayOff,
                                startTime: isDayOff
                                  ? "09:00"
                                  : row.startTime || "09:00",
                                endTime: isDayOff
                                  ? "17:00"
                                  : row.endTime || "17:00",
                              };
                            }),
                          );
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      Амралтын өдөр
                    </label>
                  </div>

                  {day.isDayOff ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Day off
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white bg-white px-2 py-1.5">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Start
                        </span>
                        <input
                          type="time"
                          value={day.startTime}
                          onChange={(e) =>
                            setSchedule((current) =>
                              current.map((row) =>
                                row.dayOfWeek === day.dayOfWeek
                                  ? { ...row, startTime: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                        />
                      </div>

                      <div className="rounded-xl border border-white bg-white px-2 py-1.5">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          End
                        </span>
                        <input
                          type="time"
                          value={day.endTime}
                          onChange={(e) =>
                            setSchedule((current) =>
                              current.map((row) =>
                                row.dayOfWeek === day.dayOfWeek
                                  ? { ...row, endTime: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={saveSchedule}
              disabled={savingSchedule || !selectedDoctorId}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSchedule ? "Хадгалж байна..." : "Хуваарь хадгалах"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filterStatus === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <select
                value={filterServiceId}
                onChange={(e) => setFilterServiceId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500"
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
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500"
              />

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Нэр эсвэл утас"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="p-4">Өвчтөн</th>
                  <th className="p-4">Огноо</th>
                  <th className="p-4">Үйлчилгээ</th>
                  <th className="p-4">Эмч</th>
                  <th className="p-4">Төлөв</th>
                  <th className="p-4 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Захиалга олдсонгүй.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">
                          {app.patient.fullName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {app.patient.phone}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-900">
                          {new Date(app.appointmentDate).toLocaleDateString(
                            "mn-MN",
                          )}
                        </div>
                        <div className="text-xs text-emerald-600 font-bold">
                          {app.startTime}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {app.service?.name || "-"}
                      </td>
                      <td className="p-4 text-slate-600">
                        {app.doctor?.name || "-"}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          {app.status === "PENDING" && (
                            <button
                              onClick={() =>
                                handleStatusChange(app.id, "CONFIRMED")
                              }
                              disabled={updatingId === app.id}
                              className="rounded-lg bg-emerald-50 p-2 text-emerald-700 disabled:opacity-50"
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
                              className="rounded-lg bg-blue-50 p-2 text-blue-700 disabled:opacity-50"
                              title="Дууссан"
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
                              className="rounded-lg bg-amber-50 p-2 text-amber-700 disabled:opacity-50"
                              title="Цуцлах"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(app.id)}
                            disabled={updatingId === app.id}
                            className="rounded-lg bg-red-50 p-2 text-red-700 disabled:opacity-50"
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
