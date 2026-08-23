"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  Mail,
  MessageSquare,
  Phone,
  Save,
  UserRound,
  X,
} from "lucide-react";

type ProfileData = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  telegramChatId?: string | null;
  role: string;
};

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Засварлах горимын state-үүд
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    phone: "",
    email: "",
    telegramChatId: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const meResponse = await fetch("/api/auth/me");
        const me = await meResponse.json();

        if (!meResponse.ok) {
          throw new Error(me.error || "Профайл мэдээллийг ачаалж чадсангүй");
        }

        const doctorId = me.data?.doctorId;
        const doctorsResponse = await fetch("/api/doctors");
        const doctorsPayload = await doctorsResponse.json();

        if (!doctorsResponse.ok) {
          throw new Error(
            doctorsPayload.error || "Эмч нарын жагсаалтыг ачаалж чадсангүй",
          );
        }

        const doctor = (doctorsPayload.data || []).find(
          (item: { id: string }) => item.id === doctorId,
        );

        const loadedProfile = {
          id: doctor?.id || doctorId,
          name: doctor?.name || me.data?.name || "Эмч",
          title: doctor?.title || "",
          phone: doctor?.phone || "",
          email: doctor?.email || me.data?.email || "",
          telegramChatId: doctor?.telegramChatId || "",
          role: me.data?.role || "ЭМЧ",
        };

        setProfile(loadedProfile);
        setFormData({
          name: loadedProfile.name,
          title: loadedProfile.title || "",
          phone: loadedProfile.phone || "",
          email: loadedProfile.email || "",
          telegramChatId: loadedProfile.telegramChatId || "",
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Мэдээлэл ачаалахад алдаа гарлаа.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Танай системийн API бүтцээс хамаарч endpoint-ийг тохируулна уу
      const response = await fetch("/api/doctor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          telegramChatId: formData.telegramChatId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Мэдээлэл хадгалахад алдаа гарлаа.");
      }

      setProfile((prev) => (prev ? { ...prev, ...formData } : null));
      setIsEditing(false);
      alert("Профайл мэдээлэл амжилттай шинэчлэгдлээ.");
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Мэдээлэл хадгалахад алдаа гарлаа.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium">Профайл мэдээллийг уншиж байна…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Профайл мэдээлэл олдсонгүй
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {error || "Хэрэглэгчийн мэдээллийг татахад боломжгүй байна."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Хувийн мэдээлэл
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            Миний профайл
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Edit3 className="h-4 w-4" />
              Мэдээлэл засах
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Болих
            </button>
          )}
          <Link
            href="/doctor"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Хянах самбар
          </Link>
        </div>
      </div>

      {isEditing ? (
        /* Засварлах Форм */
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Овог нэр
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Мэргэшил / Цол
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Ерөнхий мэргэжлийн эмч"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Утасны дугаар
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                И-мэйл хаяг
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Telegram ID / Username
              </label>
              <input
                type="text"
                placeholder="@username эсвэл Chat ID"
                value={formData.telegramChatId}
                onChange={(e) =>
                  setFormData({ ...formData, telegramChatId: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
              <p className="mt-1 text-xs text-slate-400">
                Мэдэгдэл хүлээн авах Телеграм хэрэглэгчийн нэр эсвэл ID.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </div>
        </form>
      ) : (
        /* Харж буй горим */
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
                {profile.role}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">
                {profile.name}
              </h2>
              <p className="text-sm text-slate-500">
                {profile.title || "Ерөнхий мэргэжлийн эмч"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                <Phone className="h-4 w-4 text-emerald-600" />
                Утасны дугаар
              </div>
              <p className="mt-3 text-base font-bold text-slate-900">
                {profile.phone || "Бүртгэгдээгүй"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                <Mail className="h-4 w-4 text-emerald-600" />
                И-мэйл хаяг
              </div>
              <p className="mt-3 text-base font-bold text-slate-900">
                {profile.email || "Бүртгэгдээгүй"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Telegram ID
              </div>
              <p className="mt-3 text-base font-bold text-slate-900">
                {profile.telegramChatId || "Бүртгэгдээгүй"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
