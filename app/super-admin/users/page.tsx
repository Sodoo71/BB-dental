"use client";

import Link from "next/link";
import {
  Check,
  Edit2,
  KeyRound,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/super-admin/page-header";
import { approveUser, deleteUser } from "@/lib/api/super-admin";
import { getRoleLabel } from "@/lib/roles";
import { showToast } from "@/components/ui/Toast";
import { ImageUpload } from "@/components/ui/ImageUpload";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  telegramChatId?: string | null;
  role: string;
  isActive: boolean;
  doctorId?: string | null;
  doctorTitle?: string | null;
  createdAt?: string;
};

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    avatarUrl: "",
    telegramChatId: "",
    role: "DOCTOR",
    isActive: true,
    password: "",
  });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users");
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Хэрэглэгчдийг ачаалж чадсангүй");
      setUsers(payload.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      avatarUrl: "",
      telegramChatId: "",
      role: "DOCTOR",
      isActive: true,
      password: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (user: UserRow) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      avatarUrl: user.avatarUrl || "",
      telegramChatId: user.telegramChatId || "",
      role: user.role,
      isActive: user.isActive,
      password: "",
    });
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast("Нэр болон и-мэйл хаяг шаардлагатай.", "error");
      return;
    }
    if (!editingUser && (!formData.password || formData.password.length < 6)) {
      showToast("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.", "error");
      return;
    }

    setSaving(true);
    try {
      let successMsg = "Хэрэглэгчийн мэдээлэл амжилттай хадгалагдлаа.";
      if (editingUser) {
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingUser.id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone.trim() || null,
            avatarUrl: formData.avatarUrl.trim() || null,
            telegramChatId: formData.telegramChatId.trim() || null,
            role: formData.role,
            isActive: formData.isActive,
            ...(formData.password ? { password: formData.password } : {}),
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Шинэчлэхэд алдаа гарлаа.");
        if (data.message) successMsg = data.message;
      } else {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            phone: formData.phone.trim() || null,
            avatarUrl: formData.avatarUrl.trim() || null,
            telegramChatId: formData.telegramChatId.trim() || null,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Үүсгэхэд алдаа гарлаа.");
        if (data.message) successMsg = data.message;
      }

      setModalOpen(false);
      await loadUsers();
      showToast(successMsg, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Алдаа гарлаа.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (userId: string, name: string) => {
    setProcessingId(userId);
    try {
      await approveUser(userId);
      await loadUsers();
      showToast(
        `${name} хэрэглэгчийн эрхийг амжилттай баталгаажууллаа!`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Баталгаажуулахад алдаа гарлаа.",
        "error",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`${name} хэрэглэгчийг бүрмөсөн устгах уу?`)) return;

    setProcessingId(userId);
    try {
      await deleteUser(userId);
      await loadUsers();
      showToast(`${name} хэрэглэгчийг устгалаа.`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Устгахад алдаа гарлаа.",
        "error",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = filterRole === "ALL" || u.role === filterRole;
      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && u.isActive) ||
        (filterStatus === "PENDING" && !u.isActive);
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.telegramChatId && u.telegramChatId.toLowerCase().includes(q));

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [filterRole, filterStatus, search, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Хэрэглэгчдийн удирдлага"
          description="Бүх эмч, админ, ресепшн, хэрэглэгчдийн зураг, утас, имэйл, Telegram ID болон хандах эрхийн удирдлага."
        />
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          <span>Шинэ хэрэглэгч нэмэх</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Нэр, и-мэйл, утас, Telegram ID-аар хайх..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-slate-900 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Бүх эрх</option>
            <option value="DOCTOR">Эмч</option>
            <option value="ADMIN">Ресепшн / Админ</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="PATIENT">Өвчтөн</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Бүх төлөв</option>
            <option value="ACTIVE">Идэвхтэй</option>
            <option value="PENDING">Хүлээгдэж буй</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent mr-3" />
            <span>Хэрэглэгчдийг ачаалж байна…</span>
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 bg-red-50">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-4">Хэрэглэгч</th>
                  <th className="p-4">Эрх & Мэргэжил</th>
                  <th className="p-4">Утас & Telegram</th>
                  <th className="p-4">Төлөв</th>
                  <th className="p-4">Бүртгүүлсэн</th>
                  <th className="p-4 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Хэрэглэгч олдсонгүй.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.name}
                              className="h-10 w-10 rounded-2xl object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">
                              {u.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${
                            u.role === "SUPER_ADMIN"
                              ? "bg-violet-100 text-violet-800"
                              : u.role === "ADMIN"
                                ? "bg-cyan-100 text-cyan-800"
                                : u.role === "DOCTOR"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getRoleLabel(u.role)}
                        </span>
                        {u.doctorTitle && (
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {u.doctorTitle}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-bold text-slate-800">
                          {u.phone || "—"}
                        </div>
                        {u.telegramChatId && (
                          <div className="text-[11px] text-blue-600 font-semibold">
                            TG: {u.telegramChatId}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                            Идэвхтэй
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                            Зөвшөөрөл хүлээж буй
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString("mn-MN")
                          : "—"}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!u.isActive && (
                            <button
                              type="button"
                              onClick={() => handleApprove(u.id, u.name)}
                              disabled={processingId === u.id}
                              className="rounded-xl bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100"
                              title="Бүртгэл зөвшөөрөх"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="rounded-xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
                            title="Мэдээлэл засах (Зураг, утас, TG, нууц үг)"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id, u.name)}
                            disabled={processingId === u.id}
                            className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
                            title="Хэрэглэгч устгах"
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
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                  {editingUser ? "Хэрэглэгч засах" : "Шинэ хэрэглэгч"}
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {editingUser ? editingUser.name : "Шинэ ажилтан бүртгэх"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              {/* Profile Image Upload */}
              <ImageUpload
                label="Профайл зураг (Avatar Upload)"
                value={formData.avatarUrl}
                onChange={(url) =>
                  setFormData((p) => ({ ...p, avatarUrl: url }))
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 font-bold text-slate-700 sm:col-span-2">
                  <span>Овог нэр *</span>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Батнасан Болд"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-900 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>И-мэйл хаяг *</span>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="user@bbdental.mn"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-900 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Утасны дугаар</span>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="9911-xxxx"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-900 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700 sm:col-span-2">
                  <span>Telegram Chat ID / Username</span>
                  <input
                    type="text"
                    value={formData.telegramChatId}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        telegramChatId: e.target.value,
                      }))
                    }
                    placeholder="@username эсвэл 12345678"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-900 focus:bg-white"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Системийн эрх *</span>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, role: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none"
                  >
                    <option value="DOCTOR">Эмч (Doctor)</option>
                    <option value="ADMIN">Ресепшн / Админ (Admin)</option>
                    <option value="SUPER_ADMIN">
                      Супер Админ (Super Admin)
                    </option>
                    <option value="PATIENT">Өвчтөн (Patient)</option>
                  </select>
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>
                    {editingUser
                      ? "Шинэ нууц үг (Хоосон үлдээж болно)"
                      : "Нууц үг (min 6) *"}
                  </span>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, password: e.target.value }))
                    }
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-900 focus:bg-white"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 font-bold text-slate-700 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-slate-900"
                />
                <span>Хэрэглэгчийн эрх идэвхтэй</span>
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
