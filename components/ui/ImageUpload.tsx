"use client";

import React, { useRef, useState } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";

type ImageUploadProps = {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
};

async function optimizeImageForUpload(file: File): Promise<File | Blob> {
  // If SVG or already small (< 1.2MB), keep original
  if (file.type === "image/svg+xml" || file.size < 1.2 * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1920;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
              resolve(new File([blob], cleanName, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => {
        resolve(file);
      };
      img.src = url;
    } catch {
      resolve(file);
    }
  });
}

export function ImageUpload({
  value,
  onChange,
  label = "Зураг оруулах",
  className = "",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nameLower = file.name.toLowerCase();
    const isLikelyImage =
      file.type.startsWith("image/") ||
      nameLower.endsWith(".heic") ||
      nameLower.endsWith(".heif") ||
      nameLower.endsWith(".jpg") ||
      nameLower.endsWith(".jpeg") ||
      nameLower.endsWith(".png") ||
      nameLower.endsWith(".webp") ||
      nameLower.endsWith(".svg") ||
      nameLower.endsWith(".gif");

    if (!isLikelyImage) {
      setError("Зөвхөн зургийн файл (PNG, JPG, WEBP, HEIC) сонгоно уу.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const optimizedFile = await optimizeImageForUpload(file);
      const formData = new FormData();
      formData.append("file", optimizedFile);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        if (response.status === 413 || responseText.includes("Request En")) {
          throw new Error("Зургийн хэмжээ хэтэрхий том байна.");
        }
        throw new Error(
          responseText || `Серверийн хариу: ${response.status}`,
        );
      }

      if (!response.ok) {
        throw new Error(data?.error || "Зураг хуулахад алдаа гарлаа.");
      }

      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хуулахад алдаа гарлаа.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    onChange("");
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-600">
          {label}
        </span>
      )}

      {value ? (
        <div className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <img
            src={value}
            alt="Uploaded image"
            className="h-44 w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md hover:bg-slate-100"
            >
              Солих
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center cursor-pointer transition hover:border-cyan-500 hover:bg-cyan-50/40"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
              <span className="text-xs font-bold text-slate-600">
                Зураг боловсруулж байна...
              </span>
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Зураг сонгох эсвэл чирж оруулна уу
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  JPG, PNG, WEBP, HEIC файл (Автомат оновчлогдоно)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}
