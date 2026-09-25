"use client";
import { DialogFrame } from "@/components/ui/DialogFrame";

import React, { useState } from "react";
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  Edit2,
  Loader2,
  Mail,
  Phone,
  Plus,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { useSuperAdminData } from "@/hooks/useSuperAdminData";
import { PageHeader } from "@/components/super-admin/page-header";
import { showToast } from "@/components/ui/Toast";

export default function SuperAdminDoctorsPage() {
  const { doctors, loading, refresh } = useSuperAdminData();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    specialty: "Нүүр амны эмчилгээ",
    title: "Ахлах их эмч",
    phone: "",
    email: "",
    telegramChatId: "",
    avatarUrl: "",
    experience: 5,
    description: "",
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: "",
      specialty: "Нүүр амны эмчилгээ",
      title: "Ахлах их эмч",
      phone: "",
      email: "",
      telegramChatId: "",
      avatarUrl: "",
      experience: 5,
      description: "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Эмчийн нэрийг оруулна уу.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Эмч бүртгэхэд алдаа гарлаа.");
      }

      showToast(`${formData.name} эмч амжилттай бүртгэгдлээ!`, "success");
      setModalOpen(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Эмч нарын бүртгэл & Удирдлага"
        description="Эмнэлгийн мэргэжлийн их эмч нарын мэдээлэл, мэргэшил, ажлын хуваарь ба хандах эрх."
        action={
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            <span>Шинэ эмч бүртгэх</span>
          </button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div>
            <h3 className="font-bold text-slate-900">
              Их эмч нарын нэрсийн жагсаалт
            </h3>
            <p className="text-xs text-slate-500">
              Нийт {doctors.length} эмч системд бүртгэлтэй байна
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            <span>{doctors.filter((d) => d.isActive).length} идэвхтэй эмч</span>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">
            Эмчийн мэдээлэл олдсонгүй. "Шинэ эмч бүртгэх" товчоор бүртгэнэ үү.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Мэдээллийн хүснэгт"><table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Эмчийн нэр</th>
                  <th className="px-6 py-3.5">Мэргэшил / Цол</th>
                  <th className="px-6 py-3.5">Холбогдох дугаар</th>
                  <th className="px-6 py-3.5">Telegram Chat ID</th>
                  <th className="px-6 py-3.5">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {doctors.map((doctor) => (
                  <tr
                    key={doctor.id}
                    className="hover:bg-slate-50/60 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white shadow-sm overflow-hidden">
                          {doctor.avatarUrl ? (
                            <img
                              src={doctor.avatarUrl}
                              alt={doctor.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            doctor.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {doctor.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {doctor.email || "И-мэйл бүртгэлгүй"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        {doctor.title || "Их эмч"}
                      </div>
                      <div className="text-[11px] text-brand-600 font-semibold">
                        {(doctor as any).specialty || "Нүүр амны эмчилгээ"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {doctor.phone ? (
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{doctor.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {doctor.telegramChatId ? (
                        <span className="rounded-lg bg-brand-50 px-2 py-1 font-mono text-[11px] font-bold text-brand-700 border border-brand-200">
                          TG: {doctor.telegramChatId}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Холбогдоогүй
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                          doctor.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {doctor.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>

      {/* ADD DOCTOR MODAL */}
      {modalOpen && (
        <DialogFrame onClose={() => setModalOpen(false)} label="Эмчийн мэдээлэл" size="max-w-lg">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Шинэ эмч бүртгэх
                  </h3>
                  <p className="text-xs text-slate-500">
                    Системд эмчийн мэдээлэл болон цагийн хуваарь үүсгэх
                  </p>
                </div>
              </div>
              <button aria-label="Хаах"
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <label className="block space-y-1 font-bold text-slate-700">
                <span>Эмчийн бүтэн нэр *</span>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Жишээ: Б. Тэмүүлэн"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Мэргэшил *</span>
                  <select
                    value={formData.specialty}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, specialty: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="Нүүр амны эмчилгээ">
                      Нүүр амны эмчилгээ
                    </option>
                    <option value="Нүүр амны согог засал">
                      Нүүр амны согог засал
                    </option>
                    <option value="Гажиг засал">Гажиг засал</option>
                    <option value="Хүүхдийн шүд & Мэс засал">
                      Хүүхдийн шүд & Мэс засал
                    </option>
                  </select>
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Албан тушаал / Цол</span>
                  <input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Ахлах их эмч"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Утасны дугаар</span>
                  <input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="9911xxxx"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>И-мэйл хаяг</span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="doctor@bbdental.mn"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Telegram Chat ID</span>
                  <input
                    value={formData.telegramChatId}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        telegramChatId: e.target.value,
                      }))
                    }
                    placeholder="8411351733"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Туршлага (жилээр)</span>
                  <input
                    type="number"
                    value={formData.experience}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        experience: Number(e.target.value) || 1,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  />
                </label>
              </div>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Эмчийн зургийн холбоос (Avatar URL)</span>
                <input
                  value={formData.avatarUrl}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, avatarUrl: e.target.value }))
                  }
                  placeholder="https://images.unsplash.com/..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-brand-500 focus:bg-white"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Эмч бүртгэх</span>
                </button>
              </div>
            </form>
          </div>
        </DialogFrame>
      )}
    </div>
  );
}
