"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileCheck,
  HardDrive,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/super-admin/page-header";
import { showToast } from "@/components/ui/Toast";

export default function SuperAdminSettingsPage() {
  const [loading, setLoading] = useState(true);

  // Section 1: Clinic Info
  const [clinicInfo, setClinicInfo] = useState({
    clinicName: "BB Dental Clinic",
    phone: "+976 9596-3531",
    email: "sodoosodbileg71@gmail.com",
    address:
      "БГД, 12-р хороо, 3, 4-р хороолол, Бичлийн аркны автобусны буудал дээр, Азифармтай эмийн сангийн 3 давхарт, BB Dental Clinic",
    workingHoursNote:
      "Даваа - Баасан: 09:00 - 19:00 | Бямба - Ням: 10:00 - 18:00",
  });
  const [savingClinic, setSavingClinic] = useState(false);

  // Section 2: Telegram
  const [telegramConfig, setTelegramConfig] = useState({
    botToken: "8758601589:AAFqJ_IWnBcy8lCw9Vs-iq2ZJsX9NmUZilo",
    channelId: "8411351733",
    enabled: true,
  });
  const [testChatId, setTestChatId] = useState("8411351733");
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  // Section 3: Registration Policy
  const [registrationPolicy, setRegistrationPolicy] = useState({
    autoApproveDoctors: false,
    defaultDuration: "30",
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Section 4: Diagnostics & Health
  const [pingData, setPingData] = useState<{
    latencyMs: number;
    status: string;
    dbProvider: string;
    counts: Record<string, number>;
  } | null>(null);
  const [pinging, setPinging] = useState(false);
  const [cleaningUploads, setCleaningUploads] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);

  // Load saved settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/super-admin/settings");
        const data = await res.json();
        if (res.ok && data.data) {
          if (data.data.clinic_info) setClinicInfo(data.data.clinic_info);
          if (data.data.telegram_config)
            setTelegramConfig(data.data.telegram_config);
          if (data.data.registration_policy)
            setRegistrationPolicy(data.data.registration_policy);
        }
      } catch (err) {
        showToast("Тохиргоо ачаалахад алдаа гарлаа.", "error");
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
    void handlePing();
  }, []);

  // Save Section 1: Clinic Info
  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClinic(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "clinic_info",
          data: clinicInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Хадгалж чадсангүй.");

      showToast(
        "Эмнэлгийн ерөнхий мэдээлэл амжилттай хадгалагдлаа!",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSavingClinic(false);
    }
  };

  // Save Section 2: Telegram Config
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTelegram(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "telegram_config",
          data: telegramConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Хадгалж чадсангүй.");

      showToast(
        "Telegram мэдэгдлийн тохиргоо амжилттай хадгалагдлаа!",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSavingTelegram(false);
    }
  };

  // Test Telegram Bot Message
  const handleTestTelegram = async () => {
    if (!testChatId.trim()) {
      showToast("Шалгах Telegram Chat ID эсвэл Username оруулна уу.", "error");
      return;
    }
    setTestingTelegram(true);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: testChatId.trim(),
          botToken: telegramConfig.botToken,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Тест мэдэгдэл илгээж чадсангүй.");

      showToast(
        data.message || "Тест мэдэгдэл Telegram руу амжилттай илгээгдлээ!",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setTestingTelegram(false);
    }
  };

  // Save Section 3: Registration Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "registration_policy",
          data: registrationPolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Хадгалж чадсангүй.");

      showToast(
        "Бүртгэл & Үзлэгийн бодлого амжилттай хадгалагдлаа!",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSavingPolicy(false);
    }
  };

  // Diagnostics: Ping Database
  const handlePing = async () => {
    setPinging(true);
    try {
      const res = await fetch("/api/super-admin/system/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping" }),
      });
      const data = await res.json();
      if (res.ok) {
        setPingData(data);
        showToast(
          `Өгөгдлийн сан хэвийн ажиллаж байна (${data.latencyMs}ms)`,
          "success",
        );
      }
    } catch {
      showToast("Өгөгдлийн сантай холбогдоход алдаа гарлаа.", "error");
    } finally {
      setPinging(false);
    }
  };

  // Diagnostics: Clean Unused Uploads
  const handleCleanUploads = async () => {
    if (!confirm("Ашиглагдаагүй илүүдэл зургуудыг сангаас цэвэрлэх үү?"))
      return;

    setCleaningUploads(true);
    try {
      const res = await fetch("/api/super-admin/system/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clean_uploads" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Цэвэрлэж чадсангүй.");

      showToast(data.message || "Илүүдэл файлуудыг цэвэрлэлээ.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setCleaningUploads(false);
    }
  };

  // Diagnostics: Export Full Backup JSON
  const handleExportBackup = async () => {
    setExportingBackup(true);
    try {
      const res = await fetch("/api/super-admin/system/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export_backup" }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Нөөцлөлт татаж авч чадсангүй.");

      // Trigger browser file download
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bb-dental-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("Өгөгдлийн сангийн нөөцлөлт файл (JSON) татагдлаа.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setExportingBackup(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Системийн тохиргоо & Аюулгүй байдал"
        description="Эмнэлгийн мэдээлэл, мэдэгдлийн суваг, бүртгэлийн бодлого ба өгөгдлийн сангийн өөртөө үйлчлэх оношилгоо."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD 1: CLINIC INFO */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSaveClinic} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Эмнэлгийн ерөнхий мэдээлэл
                  </h3>
                  <p className="text-xs text-slate-500">
                    Нүүр хуудас ба хэрэглэгчдэд харагдах мэдээлэл
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1 font-bold text-slate-700">
                <span>Эмнэлгийн нэр</span>
                <input
                  required
                  value={clinicInfo.clinicName}
                  onChange={(e) =>
                    setClinicInfo((p) => ({ ...p, clinicName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Холбоо барих утас</span>
                  <input
                    required
                    value={clinicInfo.phone}
                    onChange={(e) =>
                      setClinicInfo((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>И-мэйл хаяг</span>
                  <input
                    required
                    type="email"
                    value={clinicInfo.email}
                    onChange={(e) =>
                      setClinicInfo((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white"
                  />
                </label>
              </div>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Байршлын хаяг</span>
                <input
                  required
                  value={clinicInfo.address}
                  onChange={(e) =>
                    setClinicInfo((p) => ({ ...p, address: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white"
                />
              </label>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Ажиллах цагийн хуваарийн товч тайлбар</span>
                <input
                  value={clinicInfo.workingHoursNote}
                  onChange={(e) =>
                    setClinicInfo((p) => ({
                      ...p,
                      workingHoursNote: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-cyan-500 focus:bg-white"
                />
              </label>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingClinic}
                className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {savingClinic ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Эмнэлгийн мэдээлэл хадгалах</span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD 2: TELEGRAM NOTIFICATIONS */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSaveTelegram} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Telegram мэдэгдлийн тохиргоо
                  </h3>
                  <p className="text-xs text-slate-500">
                    Шинэ цаг захиалга бүртгэгдэхэд автоматаар мэдэгдэл илгээх
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1 font-bold text-slate-700">
                <span>Telegram Bot Token</span>
                <input
                  type="text"
                  value={telegramConfig.botToken}
                  onChange={(e) =>
                    setTelegramConfig((p) => ({
                      ...p,
                      botToken: e.target.value,
                    }))
                  }
                  placeholder="8188162232:AAH9..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
                />
              </label>

              {/* Telegram Test Box */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">
                    💡 Телеграм мэдэгдлийг турших:
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={testChatId}
                    onChange={(e) => setTestChatId(e.target.value)}
                    placeholder="Таны Telegram Chat ID эсвэл @username..."
                    className="flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {testingTelegram ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Тест илгээх</span>
                  </button>
                </div>
                <p className="text-[11px] text-blue-700">
                  Мэдэгдэл очихгүй бол Телеграм дээрээ bot руугаа орж{" "}
                  <strong>/start</strong> дарсан эсэхээ шалгаарай.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingTelegram}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
              >
                {savingTelegram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Телеграм тохиргоо хадгалах</span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD 3: REGISTRATION POLICY */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSavePolicy} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Бүртгэл & Үзлэгийн бодлого
                  </h3>
                  <p className="text-xs text-slate-500">
                    Шинэ хэрэглэгчийн бүртгэлийг батлах болон үзлэгийн хугацаа
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={registrationPolicy.autoApproveDoctors}
                  onChange={(e) =>
                    setRegistrationPolicy((p) => ({
                      ...p,
                      autoApproveDoctors: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded text-slate-900"
                />
                <div>
                  <span className="block font-bold text-slate-900">
                    Шинэ ажилтны бүртгэлийг шууд автоматаар зөвшөөрөх
                  </span>
                  <span className="text-slate-500 leading-relaxed">
                    Идэвхгүй үед шинээр бүртгүүлсэн эмч, админуудыг Super Admin
                    өөрөө хянаж зөвшөөрснөөр нэвтрэх эрх нээгдэнэ.
                  </span>
                </div>
              </label>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Үзлэгийн үндсэн дундаж хугацаа</span>
                <select
                  value={registrationPolicy.defaultDuration}
                  onChange={(e) =>
                    setRegistrationPolicy((p) => ({
                      ...p,
                      defaultDuration: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                >
                  <option value="15">15 минут</option>
                  <option value="30">30 минут (Стандарт)</option>
                  <option value="45">45 минут</option>
                  <option value="60">60 минут (1 цаг)</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingPolicy}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {savingPolicy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Бодлогын тохиргоо хадгалах</span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD 4: SELF-SERVICE SYSTEM HEALTH & DIAGNOSTICS */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-cyan-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white">
                    Системийн оношилгоо & Аюулгүй байдал
                  </h3>
                  <p className="text-xs text-slate-400">
                    Хөгжүүлэгчийн тусламжгүйгээр өөрөө хянах ба удирдах
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePing}
                disabled={pinging}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${pinging ? "animate-spin" : ""}`}
                />
                <span>Шалгах</span>
              </button>
            </div>

            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Баазын хариу өгөх хугацаа
                </span>
                <span className="text-base font-black text-emerald-400">
                  {pingData
                    ? `${pingData.latencyMs} ms (Маш хурдан)`
                    : "Шалгаж байна..."}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Төлөв & Холболт
                </span>
                <span className="text-base font-black text-cyan-400 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Идэвхтэй
                  (Secure)
                </span>
              </div>
            </div>

            {/* Self-service management action buttons */}
            <div className="space-y-2 pt-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Өөртөө үйлчлэх хэрэгслүүд:
              </span>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleCleanUploads}
                  disabled={cleaningUploads}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-amber-900/40 bg-amber-950/30 p-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-900/50 disabled:opacity-50"
                >
                  {cleaningUploads ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span>Ашиглагдаагүй зургийг цэвэрлэх</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={exportingBackup}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-cyan-900/40 bg-cyan-950/30 p-2.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-900/50 disabled:opacity-50"
                >
                  {exportingBackup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>Нөөцлөлт (Backup JSON) татах</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
