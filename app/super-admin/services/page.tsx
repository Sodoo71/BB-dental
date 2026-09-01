"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Edit2,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/super-admin/page-header";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { showToast } from "@/components/ui/Toast";

type ServiceItem = {
  id: string;
  name: string;
  description?: string | null;
  durationMin: string | number;
  price?: string | number | null;
  imageUrl?: string | null;
  isActive?: boolean;
  createdAt?: string;
};

export default function SuperAdminServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<string>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    durationMin: "30",
    price: "50000",
    imageUrl: "",
    isActive: true,
  });

  const loadServices = async () => {
    try {
      const response = await fetch("/api/services?all=true");
      const data = await response.json();
      if (!response.ok) throw new Error();
      setServices(data.data ?? []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData({
      name: "",
      description: "",
      durationMin: "30",
      price: "",
      imageUrl: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (service: ServiceItem) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      durationMin: String(service.durationMin),
      price: String(service.price || ""),
      imageUrl: service.imageUrl || "",
      isActive: service.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.durationMin || !formData.price) {
      showToast("Нэр, хугацаа болон үнийг заавал оруулна уу.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingService?.id) {
        const response = await fetch("/api/services", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingService.id,
            ...formData,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Шинэчлэхэд алдаа гарлаа.");
      } else {
        const response = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Үүсгэхэд алдаа гарлаа.");
      }

      setModalOpen(false);
      await loadServices();
      showToast("Үйлчилгээ амжилттай хадгалагдлаа.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Хадгалах үед алдаа гарлаа.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: ServiceItem) => {
    if (!confirm(`"${service.name}" үйлчилгээг бүрмөсөн устгах уу?`)) return;

    try {
      const response = await fetch("/api/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Устгаж чадсангүй.");
      await loadServices();
      showToast(`"${service.name}" үйлчилгээг устгалаа.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.", "error");
    }
  };

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q));

      const matchActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" && item.isActive !== false) ||
        (filterActive === "INACTIVE" && item.isActive === false);

      return matchSearch && matchActive;
    });
  }, [filterActive, search, services]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Үйлчилгээний удирдлага"
        description="Эмнэлгийн үзлэг эмчилгээний төрөл, үнэ тариф, хугацаа, тайлбар болон зургийн тохиргоо."
        action={
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Шинэ үйлчилгээ нэмэх
          </button>
        }
      />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {[
              { id: "ALL", label: `Бүгд (${services.length})` },
              {
                id: "ACTIVE",
                label: `Идэвхтэй (${services.filter((s) => s.isActive !== false).length})`,
              },
              {
                id: "INACTIVE",
                label: `Идэвхгүй (${services.filter((s) => s.isActive === false).length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterActive(tab.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  filterActive === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Үйлчилгээний нэрээр хайх..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-slate-900 mr-2" />
            <span>Үйлчилгээнүүдийг ачаалж байна...</span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Үйлчилгээ олдсонгүй.
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-md"
              >
                <div>
                  {service.imageUrl ? (
                    <div className="h-40 w-full overflow-hidden bg-slate-100">
                      <img
                        src={service.imageUrl}
                        alt={service.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-600">
                      <Sparkles className="h-8 w-8" />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{service.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          service.isActive !== false
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {service.isActive !== false ? "Идэвхтэй" : "Идэвхгүй"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-3">
                      {service.description || "Тайлбар оруулаагүй байна."}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      ⏱ {service.durationMin} минут
                    </span>
                    <span className="font-black text-slate-900">
                      {service.price
                        ? `${String(service.price).toLocaleString()}₮`
                        : "Үнэгүй"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(service)}
                      className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Засах
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(service)}
                      className="rounded-xl border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                      title="Устгах"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {editingService ? "Үйлчилгээ засах" : "Шинэ үйлчилгээ"}
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  {editingService ? editingService.name : "Үйлчилгээ бүртгэх"}
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

            <div className="space-y-4 text-xs">
              <label className="block space-y-1 font-bold text-slate-700">
                <span>Үйлчилгээний нэр *</span>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Жишээ: Шүдний ломбо тавих"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-400"
                />
              </label>

              <label className="block space-y-1 font-bold text-slate-700">
                <span>Дэлгэрэнгүй тайлбар</span>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Үйлчилгээний явц, үр дүн, зөвлөмжийн тухай мэдээлэл..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-400"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Үргэлжлэх хугацаа (минут) *</span>
                  <input
                    required
                    type="number"
                    min="5"
                    max="480"
                    value={formData.durationMin}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, durationMin: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-400"
                  />
                </label>

                <label className="block space-y-1 font-bold text-slate-700">
                  <span>Үнэ тариф (₮) *</span>
                  <input
                    required
                    type="text"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, price: e.target.value }))
                    }
                    placeholder="50000"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold outline-none focus:border-slate-400"
                  />
                </label>
              </div>

              {/* Upload image */}
              <ImageUpload
                label="Үйлчилгээний зураг (Image Upload)"
                value={formData.imageUrl}
                onChange={(url) =>
                  setFormData((p) => ({ ...p, imageUrl: url }))
                }
              />

              <label className="flex items-center gap-2 pt-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-slate-900"
                />
                <span>Энэ үйлчилгээг идэвхтэй байлгах</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
