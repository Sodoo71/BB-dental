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
import { ClinicImage } from "@/components/ui/ClinicImage";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { showToast } from "@/components/ui/Toast";

type ProfileData = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  telegramChatId?: string | null;
  role: string;
};

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    phone: "",
    email: "",
    avatarUrl: "",
    telegramChatId: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/doctor/profile");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Профайл ачаалж чадсангүй.");
        const loadedProfile = {
          ...payload.data,
          role: "DOCTOR",
          avatarUrl: payload.data.avatarUrl || payload.data.imageUrl || "",
        };

        setProfile(loadedProfile);
        setFormData({
          name: loadedProfile.name,
          title: loadedProfile.title || "",
          phone: loadedProfile.phone || "",
          email: loadedProfile.email || "",
          avatarUrl: loadedProfile.avatarUrl || "",
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
    if (saving || uploading) return;
    setSaving(true);
    try {
      const response = await fetch("/api/doctor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Мэдээлэл хадгалахад алдаа гарлаа.");
      }

      setProfile((prev) => (prev ? { ...prev, ...payload.data } : null));
      setIsEditing(false);
      showToast("Профайл мэдээлэл амжилттай шинэчлэгдлээ.", "success");
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Мэдээлэл хадгалахад алдаа гарлаа.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const testTelegram = async () => {
    setTestingTelegram(true);
    try {
      const response = await fetch("/api/doctor/telegram/test", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      showToast(data.message, "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Мэдэгдэл илгээж чадсангүй.", "error"); }
    finally { setTestingTelegram(false); }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-medium">Профайл мэдээллийг уншиж байна…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
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
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Хувийн мэдээлэл
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Миний профайл
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => {
                setFormData({
                  name: profile.name,
                  title: profile.title || "",
                  phone: profile.phone || "",
                  email: profile.email || "",
                  avatarUrl: profile.avatarUrl || "",
                  telegramChatId: profile.telegramChatId || "",
                });
                setIsEditing(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Edit3 className="h-4 w-4" />
              Мэдээлэл засах
            </button>
          ) : (
            <button
              aria-label="Хаах"
              disabled={saving || uploading}
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Болих
            </button>
          )}
          <Link
            href="/doctor"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Хянах самбар
          </Link>
        </div>
      </div>

      {isEditing ? (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6"
        >
          <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Овог нэр *
              </label>
              <input
                type="text"
                required
                id="profile-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-title"
                className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Мэргэшил / Цол
              </label>
              <input
                type="text"
                id="profile-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Ерөнхий мэргэжлийн их эмч"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-phone"
                className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Утасны дугаар
              </label>
              <input
                type="text"
                id="profile-phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-email"
                className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                И-мэйл хаяг
              </label>
              <input
                type="email"
                id="profile-email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="profile-telegramChatId"
                className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                Telegram Chat ID
              </label>
              <input
                type="text"
                placeholder="Тоон Chat ID"
                id="profile-telegramChatId"
                value={formData.telegramChatId}
                onChange={(e) =>
                  setFormData({ ...formData, telegramChatId: e.target.value })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
              <p className="mt-1 text-xs text-slate-400">
                BB_dental_bot дээр /start дарсны дараа хувийн тоон Chat ID-гаа оруулаад хадгална уу. Группийн ID эсвэл @username оруулахгүй.
              </p>
            </div>

            {/* Profile Avatar Upload */}
            <div className="md:col-span-2">
              <ImageUpload
                onUploadingChange={setUploading}
                label="Профайл зураг"
                value={formData.avatarUrl}
                onChange={(url) =>
                  setFormData((prev) => ({ ...prev, avatarUrl: url }))
                }
              />
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 sm:flex sm:justify-end">
            <button
              type="button"
              disabled={saving || uploading}
              onClick={() => setIsEditing(false)}
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:px-5"
            >
              <Save className="h-4 w-4" />
              {saving ? "Хадгалж байна…" : "Хадгалах"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <div className="mb-6 flex items-center gap-4">
            {profile.avatarUrl ? (
              <div className="h-20 w-20 overflow-hidden rounded-2xl border-2 border-emerald-500 shadow-md">
                <ClinicImage
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <UserRound className="h-9 w-9" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
                {profile.role}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">
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
              <p className="mt-3 break-all text-base font-bold text-slate-900">
                {profile.phone || "Бүртгэгдээгүй"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                <Mail className="h-4 w-4 text-emerald-600" />
                И-мэйл хаяг
              </div>
              <p className="mt-3 break-all text-base font-bold text-slate-900">
                {profile.email || "Бүртгэгдээгүй"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Telegram ID
              </div>
              <p className="mt-3 break-all text-base font-bold text-slate-900">
                {profile.telegramChatId || "Бүртгэгдээгүй"}
              </p>
              <a href="https://t.me/BB_dental_bot" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-700 underline">Telegram bot нээх</a>
              <button type="button" disabled={!profile.telegramChatId || testingTelegram} onClick={testTelegram} className="button-secondary mt-2 w-full disabled:opacity-50">{testingTelegram ? "Илгээж байна…" : "Туршилтын мэдэгдэл илгээх"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
